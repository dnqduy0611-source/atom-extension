// Supabase Edge Function: Create PayOS Payment Order
// Creates a new order and returns PayOS checkout URL + QR code
// Deploy: npx supabase functions deploy create-order

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// PayOS config
const PAYOS_CLIENT_ID = Deno.env.get('PAYOS_CLIENT_ID')!;
const PAYOS_API_KEY = Deno.env.get('PAYOS_API_KEY')!;
const PAYOS_CHECKSUM_KEY = Deno.env.get('PAYOS_CHECKSUM_KEY')!;
const PAYOS_API_URL = 'https://api-merchant.payos.vn';

// ── Pricing VND ──
const PRICING: Record<string, { amount: number; label: string; type: 'subscription' | 'credits'; credits?: number }> = {
    premium_monthly: { amount: 25000, label: 'AmoLofi Pro Monthly', type: 'subscription' },
    premium_yearly: { amount: 179000, label: 'AmoLofi Pro Yearly', type: 'subscription' },
    credits_50: { amount: 25000, label: '50 Credits', type: 'credits', credits: 50 },
    credits_150: { amount: 49000, label: '150 Credits', type: 'credits', credits: 150 },
    credits_500: { amount: 119000, label: '500 Credits', type: 'credits', credits: 500 },
};

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
    });
}

// ── HMAC-SHA256 signature for PayOS ──
async function createSignature(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(PAYOS_CHECKSUM_KEY),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    return Array.from(new Uint8Array(signatureBytes))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Generate unique order code (PayOS requires positive integer)
function generateOrderCode(): number {
    // Use timestamp-based code to ensure uniqueness: last 10 digits of timestamp + random
    const ts = Date.now() % 1_000_000_000; // 9 digits from timestamp
    const rand = Math.floor(Math.random() * 900) + 100; // 3-digit random
    return parseInt(`${ts}${rand}`);
}

// ── Main handler ──
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS_HEADERS });
    }
    if (req.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
        // Auth: get user from JWT
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: authError } = await userClient.auth.getUser();
        if (authError || !user) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Parse request
        const body = await req.json();
        const { product_type, phone_number } = body;

        if (!product_type || !PRICING[product_type]) {
            return jsonResponse({ error: `Invalid product_type. Valid: ${Object.keys(PRICING).join(', ')}` }, 400);
        }
        if (!phone_number || !/^0\d{9}$/.test(phone_number)) {
            return jsonResponse({ error: 'Invalid phone_number. Must be 10 digits starting with 0' }, 400);
        }

        const product = PRICING[product_type];
        const orderCode = generateOrderCode();

        // PayOS only allows 9 chars for description on non-linked banks
        // Use a short format: AMOLOFI + truncated phone
        const description = `AMOLOFI`;

        const returnUrl = `https://lofi.amonexus.com/checkout/success?orderCode=${orderCode}`;
        const cancelUrl = `https://lofi.amonexus.com/checkout/cancel?orderCode=${orderCode}`;

        // Create PayOS signature
        // Format: amount=$amount&cancelUrl=$cancelUrl&description=$description&orderCode=$orderCode&returnUrl=$returnUrl
        const signatureData = `amount=${product.amount}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${returnUrl}`;
        const signature = await createSignature(signatureData);

        // Create PayOS payment link
        const payosPayload = {
            orderCode,
            amount: product.amount,
            description,
            buyerName: user.user_metadata?.full_name || '',
            buyerEmail: user.email || '',
            buyerPhone: phone_number,
            items: [
                {
                    name: product.label,
                    quantity: 1,
                    price: product.amount,
                },
            ],
            cancelUrl,
            returnUrl,
            expiredAt: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
            signature,
        };

        console.log('[CreateOrder] Calling PayOS:', JSON.stringify({ orderCode, amount: product.amount, product_type }));

        const payosRes = await fetch(`${PAYOS_API_URL}/v2/payment-requests`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-client-id': PAYOS_CLIENT_ID,
                'x-api-key': PAYOS_API_KEY,
            },
            body: JSON.stringify(payosPayload),
        });

        const payosData = await payosRes.json();

        if (payosData.code !== '00') {
            console.error('[CreateOrder] PayOS error:', JSON.stringify(payosData));
            return jsonResponse({ error: 'Failed to create payment link', detail: payosData.desc }, 502);
        }

        // Save order to database
        const { error: insertError } = await supabase
            .from('orders')
            .insert({
                user_id: user.id,
                order_code: orderCode,
                phone_number,
                product_type,
                amount_vnd: product.amount,
                payment_provider: 'payos',
                status: 'pending',
                payos_payment_link_id: payosData.data.paymentLinkId,
                payos_checkout_url: payosData.data.checkoutUrl,
                expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            });

        if (insertError) {
            console.error('[CreateOrder] DB insert error:', insertError);
            return jsonResponse({ error: 'Failed to save order' }, 500);
        }

        console.log(`[CreateOrder] Order ${orderCode} created for user ${user.id}`);

        return jsonResponse({
            success: true,
            order: {
                orderCode,
                amount: product.amount,
                productType: product_type,
                productLabel: product.label,
                checkoutUrl: payosData.data.checkoutUrl,
                qrCode: payosData.data.qrCode,
                accountNumber: payosData.data.accountNumber,
                accountName: payosData.data.accountName,
                bin: payosData.data.bin,
                description: payosData.data.description,
                expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            },
        });

    } catch (err) {
        console.error('[CreateOrder] Unhandled error:', err);
        return jsonResponse({ error: 'Internal server error' }, 500);
    }
});
