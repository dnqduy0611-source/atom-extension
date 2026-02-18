// Supabase Edge Function: PayOS Webhook Handler
// Receives payment confirmation from PayOS and activates user subscriptions/credits
// Deploy: npx supabase functions deploy payos-webhook

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PAYOS_CHECKSUM_KEY = Deno.env.get('PAYOS_CHECKSUM_KEY')!;

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
    });
}

// ── Verify PayOS webhook signature ──
// PayOS webhook signature is HMAC_SHA256 of sorted data fields
async function verifyWebhookSignature(data: Record<string, unknown>, signature: string): Promise<boolean> {
    if (!PAYOS_CHECKSUM_KEY || !signature) return false;

    // Sort keys alphabetically and build "key=value&key=value" string
    const sortedKeys = Object.keys(data).sort();
    const signatureData = sortedKeys
        .map(key => `${key}=${data[key] ?? ''}`)
        .join('&');

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(PAYOS_CHECKSUM_KEY),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureData));
    const computedHex = Array.from(new Uint8Array(signatureBytes))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return computedHex === signature;
}

// ── Product → subscription duration mapping ──
function getSubscriptionEndDate(productType: string): Date {
    const now = new Date();
    switch (productType) {
        case 'premium_monthly':
            return new Date(now.setMonth(now.getMonth() + 1));
        case 'premium_yearly':
            return new Date(now.setFullYear(now.getFullYear() + 1));
        default:
            return new Date(now.setMonth(now.getMonth() + 1));
    }
}

// Credit amounts for credit packs
const CREDIT_AMOUNTS: Record<string, number> = {
    credits_50: 50,
    credits_150: 150,
    credits_500: 500,
};

// ── Main handler ──
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS_HEADERS });
    }
    if (req.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
        const body = await req.json();
        console.log('[PayOS Webhook] Received:', JSON.stringify(body));

        // PayOS webhook format:
        // { code: "00", desc: "success", success: true, data: { orderCode, amount, ... }, signature: "..." }
        const { code, data, signature } = body;

        // Only process successful payments
        if (code !== '00' || !data) {
            console.log('[PayOS Webhook] Non-success event, ignoring');
            return jsonResponse({ success: true });
        }

        // Verify signature
        const isValid = await verifyWebhookSignature(data, signature);
        if (!isValid) {
            console.error('[PayOS Webhook] Invalid signature');
            // Still return 200 to prevent PayOS from retrying
            // But log for investigation
            console.error('[PayOS Webhook] Signature mismatch. Data:', JSON.stringify(data));
        }

        const orderCode = data.orderCode;
        const amount = data.amount;
        const reference = data.reference; // Bank transaction reference

        if (!orderCode) {
            console.error('[PayOS Webhook] Missing orderCode');
            return jsonResponse({ success: true });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        // Look up the order
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('order_code', orderCode)
            .single();

        if (orderError || !order) {
            console.error(`[PayOS Webhook] Order not found: ${orderCode}`, orderError);
            return jsonResponse({ success: true });
        }

        // Skip if already paid (idempotency)
        if (order.status === 'paid') {
            console.log(`[PayOS Webhook] Order ${orderCode} already paid, skipping`);
            return jsonResponse({ success: true });
        }

        // Verify amount matches
        if (amount !== order.amount_vnd) {
            console.error(`[PayOS Webhook] Amount mismatch! Expected ${order.amount_vnd}, got ${amount}`);
            // Still mark as paid but log the discrepancy
        }

        // ━━━ Update order status ━━━
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                status: 'paid',
                paid_at: new Date().toISOString(),
                payos_reference: reference || null,
            })
            .eq('id', order.id);

        if (updateError) {
            console.error('[PayOS Webhook] Failed to update order:', updateError);
        }

        // ━━━ Activate subscription or credits ━━━
        const productType = order.product_type;

        if (productType.startsWith('premium_')) {
            // Subscription: activate Pro
            const endDate = getSubscriptionEndDate(productType);
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    is_pro: true,
                    subscription_status: 'active',
                    payment_provider: 'payos',
                    subscription_start_date: new Date().toISOString(),
                    subscription_end_date: endDate.toISOString(),
                })
                .eq('id', order.user_id);

            if (profileError) {
                console.error('[PayOS Webhook] Failed to update profile:', profileError);
            } else {
                console.log(`[PayOS Webhook] ✅ Pro activated for ${order.user_id} until ${endDate.toISOString()}`);
            }

            // Grant monthly credits for subscription
            try {
                await supabase.rpc('add_credits', {
                    p_user_id: order.user_id,
                    p_amount: 30,
                    p_reason: 'subscription_grant',
                    p_meta: { order_code: orderCode, product_type: productType, provider: 'payos' },
                });
                console.log(`[PayOS Webhook] Granted 30 subscription credits to ${order.user_id}`);
            } catch (e) {
                console.error('[PayOS Webhook] Failed to grant subscription credits:', e);
            }

        } else if (CREDIT_AMOUNTS[productType]) {
            // Credit pack: add credits
            const creditAmount = CREDIT_AMOUNTS[productType];
            try {
                const { data: result } = await supabase.rpc('add_credits', {
                    p_user_id: order.user_id,
                    p_amount: creditAmount,
                    p_reason: 'purchase',
                    p_meta: { order_code: orderCode, product_type: productType, provider: 'payos' },
                });
                console.log(`[PayOS Webhook] ✅ Added ${creditAmount} credits to ${order.user_id}. Balance: ${result?.balance}`);
            } catch (e) {
                console.error('[PayOS Webhook] Failed to add credits:', e);
            }
        }

        return jsonResponse({ success: true });

    } catch (err) {
        console.error('[PayOS Webhook] Unhandled error:', err);
        // Always return 200 to prevent PayOS from retrying on our errors
        return jsonResponse({ success: true });
    }
});
