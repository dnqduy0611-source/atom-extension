import { useState } from 'react';
import { useCredits } from '../../hooks/useCredits';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { useLofiStore } from '../../store/useLofiStore';

/**
 * ProUpgradeModal — Premium subscription + Credit Packs.
 *
 * 2-column layout:
 *   Left:  Premium subscription (Monthly / Yearly toggle)
 *   Right: Credit packs (50 / 150 / 500)
 *
 * LemonSqueezy checkout integration:
 *   Opens LemonSqueezy checkout overlay with user_id in custom_data.
 *   After payment, lemon-webhook Edge Function handles credit grants.
 */

// ── LemonSqueezy Configuration ──
const LEMON_STORE = 'https://amonexus.lemonsqueezy.com';

const CHECKOUT_URLS: Record<string, string> = {
    // Subscriptions
    premium_monthly: `${LEMON_STORE}/checkout/buy/3b970ba9-906a-43cd-859a-6c9191893bb1`,
    premium_yearly: `${LEMON_STORE}/checkout/buy/17f6b711-0b76-43b0-8a9f-775bc470aebf`,
    // Credit packs
    credits_50: `${LEMON_STORE}/checkout/buy/08236f00-836d-43f6-a240-2aefa1ec4139`,
    credits_150: `${LEMON_STORE}/checkout/buy/c9e109aa-c1db-49b5-8f61-8367b95c8199`,
    credits_500: `${LEMON_STORE}/checkout/buy/ec90b757-c768-4537-8a16-f82c0c1a76bb`,
};

interface Props {
    onClose: () => void;
    onSelectPlan?: (plan: string) => void;
}

const PREMIUM_FEATURE_KEYS = [
    { key: 'pro.feat.freeTrial', highlight: true },
    { key: 'pro.feat.allScenes', highlight: false },
    { key: 'pro.feat.allSounds', highlight: false },
    { key: 'pro.feat.aiCreate', highlight: true },
    { key: 'pro.feat.monthlyCredits', highlight: true },
    { key: 'pro.feat.stats', highlight: false },
    { key: 'pro.feat.wallpaper', highlight: false },
];

const CREDIT_PACKS = [
    { id: 'credits_50', amount: 50, price: '$0.99', priceVN: '25.000₫', perSceneKey: 'pro.scenes5', popular: false },
    { id: 'credits_150', amount: 150, price: '$1.99', priceVN: '49.000₫', perSceneKey: 'pro.scenes15', popular: true },
    { id: 'credits_500', amount: 500, price: '$4.99', priceVN: '119.000₫', perSceneKey: 'pro.scenes50', popular: false },
];

// PayOS checkout URL for Vietnamese users
const PAYOS_CHECKOUT_URL = 'https://lofi.amonexus.com/checkout';

// isVietnamese is now determined inside the component using app locale

export function ProUpgradeModal({ onClose, onSelectPlan }: Props) {
    const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly');
    const { user } = useAuth();
    const { balance } = useCredits();
    const { t } = useTranslation();
    const appLocale = useLofiStore((s) => s.locale);
    const isVN = appLocale === 'vi';

    const monthlyPrice = isVN ? '49.000₫' : '$1.99';
    const yearlyPrice = isVN ? '29.000₫' : '$1.25';
    const yearlyTotal = isVN ? '349.000₫' : '$14.99';

    const handleCheckout = (planId: string) => {
        // Vietnamese users → PayOS checkout
        if (isVN) {
            const payosUrl = new URL(PAYOS_CHECKOUT_URL);
            payosUrl.searchParams.set('plan', planId);
            window.open(payosUrl.toString(), '_blank');
            onSelectPlan?.(planId);
            return;
        }

        // International users → LemonSqueezy
        const url = CHECKOUT_URLS[planId];
        if (!url || url.includes('TODO')) {
            onSelectPlan?.(planId);
            console.warn(`[Checkout] Product not configured: ${planId}`);
            return;
        }

        const checkoutUrl = new URL(url);
        if (user) {
            checkoutUrl.searchParams.set('checkout[custom][user_id]', user.id);
            checkoutUrl.searchParams.set('checkout[email]', user.email || '');
        }

        window.open(checkoutUrl.toString(), '_blank');
        onSelectPlan?.(planId);
    };

    return (
        <div className="pum-overlay" onClick={onClose}>
            <div className="pum-container" onClick={(e) => e.stopPropagation()}>
                {/* Close button */}
                <button className="pum-close" onClick={onClose}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>

                {/* Header */}
                <div className="pum-header">
                    <h2 className="pum-title">{t('pro.title')}</h2>
                    <p className="pum-subtitle">{t('pro.subtitle')}</p>
                    {user && (
                        <div className="pum-balance-pill">
                            💎 {t('pro.balance')} <strong>{balance}</strong> {t('pro.credits')}
                        </div>
                    )}
                </div>

                {/* Main 2-column layout */}
                <div className="pum-grid">
                    {/* ── Left: Premium Subscription ── */}
                    <div className="pum-plan featured">
                        <div className="pum-plan-header">
                            <div className="pum-plan-badge">{t('pro.favorite')}</div>
                            <h3 className="pum-plan-name">{t('pro.premium')}</h3>

                            {/* Billing toggle */}
                            <div className="pum-toggle-row">
                                <button
                                    className={`pum-toggle-btn ${billing === 'monthly' ? 'active' : ''}`}
                                    onClick={() => setBilling('monthly')}
                                >
                                    {t('pro.monthly')}
                                </button>
                                <button
                                    className={`pum-toggle-btn highlight ${billing === 'yearly' ? 'active' : ''}`}
                                    onClick={() => setBilling('yearly')}
                                >
                                    {t('pro.yearly')} <span className="pum-save-badge">{t('pro.save')}</span>
                                </button>
                            </div>

                            <div className="pum-price-row">
                                <span className="pum-price">{billing === 'yearly' ? yearlyPrice : monthlyPrice}</span>
                                <span className="pum-price-period">{t('pro.perMonth')}</span>
                            </div>
                            <p className="pum-price-note">
                                {billing === 'yearly'
                                    ? t('pro.billedYearly', yearlyTotal)
                                    : t('pro.billedMonthly')
                                }
                            </p>
                        </div>

                        <ul className="pum-features">
                            {PREMIUM_FEATURE_KEYS.map((f) => (
                                <li key={f.key} className="pum-feature">
                                    <span className={`pum-check ${f.highlight ? 'green' : ''}`}>✓</span>
                                    <span className={f.highlight ? 'bold' : ''}>{t(f.key as any)}</span>
                                </li>
                            ))}
                        </ul>

                        <button
                            className="pum-plan-btn premium"
                            onClick={() => handleCheckout(billing === 'yearly' ? 'premium_yearly' : 'premium_monthly')}
                        >
                            {t('pro.startFreeTrial')}
                        </button>
                    </div>

                    {/* ── Right: Credit Packs ── */}
                    <div className="pum-plan">
                        <div className="pum-plan-header">
                            <h3 className="pum-plan-name">{t('pro.buyCredits')}</h3>
                            <p className="pum-credits-desc" dangerouslySetInnerHTML={{ __html: t('pro.creditsDesc') }} />
                        </div>

                        <div className="pum-packs">
                            {CREDIT_PACKS.map((pack) => (
                                <button
                                    key={pack.id}
                                    className={`pum-pack ${pack.popular ? 'popular' : ''}`}
                                    onClick={() => handleCheckout(pack.id)}
                                >
                                    <div className="pum-pack-left">
                                        <span className="pum-pack-amount">💎 {pack.amount}</span>
                                        <span className="pum-pack-scenes">{t(pack.perSceneKey as any)}</span>
                                    </div>
                                    <div className="pum-pack-right">
                                        <span className="pum-pack-price">{isVN ? pack.priceVN : pack.price}</span>
                                        {pack.popular && <span className="pum-popular-tag">{t('pro.popular')}</span>}
                                    </div>
                                </button>
                            ))}
                        </div>

                        <p className="pum-packs-note">
                            {t('pro.creditsNote')}
                        </p>
                    </div>
                </div>
            </div>

            <style>{`
                .pum-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0, 0, 0, 0.75);
                    backdrop-filter: blur(12px);
                    animation: pumFadeIn 0.3s ease-out;
                }
                @keyframes pumFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .pum-container {
                    position: relative;
                    width: 95%;
                    max-width: 780px;
                    max-height: 90vh;
                    overflow-y: auto;
                    border-radius: 24px;
                    padding: 40px 36px 36px;
                    background: linear-gradient(180deg, rgba(30,30,35,0.98) 0%, rgba(18,18,22,0.99) 100%);
                    border: 1px solid rgba(255,255,255,0.08);
                    box-shadow:
                        0 32px 80px rgba(0,0,0,0.6),
                        0 0 0 1px rgba(255,255,255,0.04) inset;
                    animation: pumSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
                    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
                }
                @keyframes pumSlideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                .pum-close {
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 10px;
                    border: none;
                    background: rgba(255,255,255,0.06);
                    color: rgba(255,255,255,0.5);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .pum-close:hover {
                    background: rgba(255,255,255,0.12);
                    color: white;
                }

                .pum-header {
                    text-align: center;
                    margin-bottom: 28px;
                }
                .pum-title {
                    font-size: 28px;
                    font-weight: 700;
                    color: white;
                    margin: 0 0 8px;
                    letter-spacing: -0.3px;
                }
                .pum-subtitle {
                    font-size: 14px;
                    color: rgba(255,255,255,0.5);
                    margin: 0 0 16px;
                }
                .pum-balance-pill {
                    display: inline-block;
                    padding: 6px 14px;
                    border-radius: 20px;
                    background: rgba(102,126,234,0.1);
                    border: 1px solid rgba(102,126,234,0.2);
                    color: rgba(255,255,255,0.8);
                    font-size: 13px;
                }
                .pum-balance-pill strong {
                    color: #667eea;
                }

                /* ── 2-column grid ── */
                .pum-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                    align-items: start;
                }

                .pum-plan {
                    border-radius: 18px;
                    padding: 28px 24px;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.06);
                    transition: all 0.3s;
                    display: flex;
                    flex-direction: column;
                }
                .pum-plan:hover {
                    border-color: rgba(255,255,255,0.12);
                    background: rgba(255,255,255,0.05);
                }
                .pum-plan.featured {
                    background: rgba(16,185,129,0.04);
                    border: 1.5px solid rgba(16,185,129,0.25);
                    box-shadow: 0 0 40px rgba(16,185,129,0.08);
                }
                .pum-plan.featured:hover {
                    border-color: rgba(16,185,129,0.4);
                }

                .pum-plan-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 8px;
                    background: rgba(16,185,129,0.12);
                    color: #34d399;
                    font-size: 11px;
                    font-weight: 600;
                    margin-bottom: 12px;
                }

                .pum-plan-header {
                    margin-bottom: 20px;
                }
                .pum-plan-name {
                    font-size: 18px;
                    font-weight: 700;
                    color: white;
                    margin: 0 0 12px;
                }
                .pum-credits-desc {
                    font-size: 13px;
                    color: rgba(255,255,255,0.5);
                    margin: 0;
                    line-height: 1.5;
                }
                .pum-credits-desc strong {
                    color: rgba(255,255,255,0.85);
                }

                /* Billing toggle */
                .pum-toggle-row {
                    display: flex;
                    gap: 4px;
                    margin-bottom: 16px;
                    padding: 3px;
                    border-radius: 10px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.06);
                    width: fit-content;
                }
                .pum-toggle-btn {
                    padding: 6px 14px;
                    border-radius: 8px;
                    border: none;
                    background: transparent;
                    color: rgba(255,255,255,0.45);
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
                }
                .pum-toggle-btn.active {
                    background: rgba(255,255,255,0.1);
                    color: white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                }
                .pum-toggle-btn.highlight.active {
                    background: rgba(16,185,129,0.15);
                    color: #34d399;
                    border: 1px solid rgba(16,185,129,0.3);
                }
                .pum-save-badge {
                    display: inline-block;
                    font-size: 10px;
                    font-weight: 700;
                    color: #10b981;
                    margin-left: 4px;
                }

                .pum-price-row {
                    display: flex;
                    align-items: baseline;
                    gap: 4px;
                }
                .pum-price {
                    font-size: 38px;
                    font-weight: 700;
                    color: white;
                    letter-spacing: -1px;
                    line-height: 1;
                }
                .pum-price-period {
                    font-size: 14px;
                    color: rgba(255,255,255,0.4);
                }
                .pum-price-note {
                    font-size: 12px;
                    color: rgba(255,255,255,0.35);
                    margin: 6px 0 0;
                }

                /* Feature list */
                .pum-features {
                    list-style: none;
                    padding: 0;
                    margin: 0 0 24px;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .pum-feature {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    font-size: 13px;
                    color: rgba(255,255,255,0.7);
                    line-height: 1.4;
                }
                .pum-feature .bold {
                    font-weight: 600;
                    color: rgba(255,255,255,0.9);
                }
                .pum-check {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.06);
                    color: rgba(255,255,255,0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 11px;
                    font-weight: 700;
                    flex-shrink: 0;
                }
                .pum-check.green {
                    background: rgba(16,185,129,0.15);
                    color: #34d399;
                }

                /* CTA buttons */
                .pum-plan-btn {
                    width: 100%;
                    padding: 12px;
                    border-radius: 12px;
                    border: none;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.25s;
                }
                .pum-plan-btn.premium {
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: white;
                    box-shadow: 0 4px 20px rgba(16,185,129,0.3);
                }
                .pum-plan-btn.premium:hover {
                    box-shadow: 0 6px 28px rgba(16,185,129,0.45);
                    transform: translateY(-1px);
                }

                /* ── Credit Packs ── */
                .pum-packs {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    margin-bottom: 16px;
                    flex: 1;
                }
                .pum-pack {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 14px 16px;
                    border-radius: 12px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.08);
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: left;
                }
                .pum-pack:hover {
                    background: rgba(255,255,255,0.08);
                    border-color: rgba(255,255,255,0.15);
                    transform: translateY(-1px);
                }
                .pum-pack.popular {
                    border-color: rgba(102,126,234,0.3);
                    background: rgba(102,126,234,0.06);
                }
                .pum-pack.popular:hover {
                    border-color: rgba(102,126,234,0.5);
                    background: rgba(102,126,234,0.1);
                }

                .pum-pack-left {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .pum-pack-amount {
                    font-size: 15px;
                    font-weight: 700;
                    color: white;
                }
                .pum-pack-scenes {
                    font-size: 11px;
                    color: rgba(255,255,255,0.4);
                }
                .pum-pack-right {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 4px;
                }
                .pum-pack-price {
                    font-size: 16px;
                    font-weight: 700;
                    color: white;
                }
                .pum-popular-tag {
                    font-size: 10px;
                    font-weight: 600;
                    padding: 2px 8px;
                    border-radius: 6px;
                    background: rgba(102,126,234,0.15);
                    color: #667eea;
                }

                .pum-packs-note {
                    font-size: 11px;
                    color: rgba(255,255,255,0.3);
                    text-align: center;
                    margin: 0;
                    line-height: 1.5;
                }

                /* ── Responsive ── */
                @media (max-width: 768px) {
                    .pum-container { padding: 28px 16px 24px; }
                    .pum-grid {
                        grid-template-columns: 1fr;
                        gap: 12px;
                    }
                    .pum-title { font-size: 22px; }
                    .pum-price { font-size: 30px; }
                }

                /* Scrollbar */
                .pum-container::-webkit-scrollbar { width: 4px; }
                .pum-container::-webkit-scrollbar-track { background: transparent; }
                .pum-container::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 4px;
                }
            `}</style>
        </div>
    );
}
