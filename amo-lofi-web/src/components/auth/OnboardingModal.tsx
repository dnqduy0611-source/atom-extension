import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';

/**
 * OnboardingModal — Shown once after first Google OAuth login.
 * Collects: display name, country, phone (optional).
 * Country determines PayOS (VN) vs LemonSqueezy (international).
 */

interface Props {
    onComplete: () => void;
}

const COUNTRIES = [
    { code: 'VN', name: '🇻🇳 Việt Nam', nameEn: '🇻🇳 Vietnam' },
    { code: 'US', name: '🇺🇸 Hoa Kỳ', nameEn: '🇺🇸 United States' },
    { code: 'GB', name: '🇬🇧 Anh', nameEn: '🇬🇧 United Kingdom' },
    { code: 'JP', name: '🇯🇵 Nhật Bản', nameEn: '🇯🇵 Japan' },
    { code: 'KR', name: '🇰🇷 Hàn Quốc', nameEn: '🇰🇷 South Korea' },
    { code: 'SG', name: '🇸🇬 Singapore', nameEn: '🇸🇬 Singapore' },
    { code: 'AU', name: '🇦🇺 Úc', nameEn: '🇦🇺 Australia' },
    { code: 'DE', name: '🇩🇪 Đức', nameEn: '🇩🇪 Germany' },
    { code: 'FR', name: '🇫🇷 Pháp', nameEn: '🇫🇷 France' },
    { code: 'CA', name: '🇨🇦 Canada', nameEn: '🇨🇦 Canada' },
    { code: 'TH', name: '🇹🇭 Thái Lan', nameEn: '🇹🇭 Thailand' },
    { code: 'ID', name: '🇮🇩 Indonesia', nameEn: '🇮🇩 Indonesia' },
    { code: 'MY', name: '🇲🇾 Malaysia', nameEn: '🇲🇾 Malaysia' },
    { code: 'PH', name: '🇵🇭 Philippines', nameEn: '🇵🇭 Philippines' },
    { code: 'IN', name: '🇮🇳 Ấn Độ', nameEn: '🇮🇳 India' },
    { code: 'OTHER', name: '🌍 Khác', nameEn: '🌍 Other' },
];

export function OnboardingModal({ onComplete }: Props) {
    const { user } = useAuth();
    const isVi = (navigator.language || '').startsWith('vi');

    const [displayName, setDisplayName] = useState(
        user?.user_metadata?.full_name || ''
    );
    const [country, setCountry] = useState(() => {
        // Auto-detect: timezone Asia/Ho_Chi_Minh → VN (no longer uses browser language)
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz === 'Asia/Ho_Chi_Minh' || tz === 'Asia/Saigon') return 'VN';
        return '';
    });
    const [phone, setPhone] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!country) {
            setError(isVi ? 'Vui lòng chọn quốc gia' : 'Please select your country');
            return;
        }

        setSaving(true);
        setError('');

        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                display_name: displayName || user?.email?.split('@')[0] || '',
                country,
                phone: phone || null,
                onboarding_completed: true,
                updated_at: new Date().toISOString(),
            })
            .eq('id', user!.id);

        if (updateError) {
            console.error('[Onboarding] Update error:', updateError);
            setError(isVi ? 'Lỗi lưu thông tin. Thử lại.' : 'Failed to save. Please try again.');
            setSaving(false);
            return;
        }

        setSaving(false);
        onComplete();
    };

    const handleSkip = async () => {
        // Mark onboarding as completed but without data
        await supabase
            .from('profiles')
            .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
            .eq('id', user!.id);
        onComplete();
    };

    return (
        <div className="ob-overlay">
            <div className="ob-container">
                {/* Header */}
                <div className="ob-header">
                    <div className="ob-icon">👋</div>
                    <h2 className="ob-title">
                        {isVi ? 'Chào mừng bạn!' : 'Welcome!'}
                    </h2>
                    <p className="ob-subtitle">
                        {isVi
                            ? 'Hoàn tất hồ sơ nhanh để có trải nghiệm tốt nhất'
                            : 'Complete your profile for the best experience'}
                    </p>
                </div>

                {/* Form */}
                <div className="ob-form">
                    {/* Display Name */}
                    <div className="ob-field">
                        <label className="ob-label">
                            {isVi ? 'Tên hiển thị' : 'Display Name'}
                        </label>
                        <input
                            type="text"
                            className="ob-input"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder={isVi ? 'Nhập tên của bạn' : 'Enter your name'}
                        />
                    </div>

                    {/* Country */}
                    <div className="ob-field">
                        <label className="ob-label">
                            {isVi ? 'Quốc gia' : 'Country'} <span className="ob-required">*</span>
                        </label>
                        <select
                            className="ob-select"
                            value={country}
                            onChange={(e) => { setCountry(e.target.value); setError(''); }}
                        >
                            <option value="">{isVi ? '— Chọn quốc gia —' : '— Select country —'}</option>
                            {COUNTRIES.map((c) => (
                                <option key={c.code} value={c.code}>
                                    {isVi ? c.name : c.nameEn}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Phone — only show for VN */}
                    {country === 'VN' && (
                        <div className="ob-field">
                            <label className="ob-label">
                                Số điện thoại <span className="ob-optional">(tùy chọn)</span>
                            </label>
                            <input
                                type="tel"
                                className="ob-input"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="0912 345 678"
                                maxLength={10}
                            />
                        </div>
                    )}

                    {/* Error */}
                    {error && <p className="ob-error">{error}</p>}

                    {/* Buttons */}
                    <div className="ob-actions">
                        <button
                            className="ob-btn primary"
                            onClick={handleSubmit}
                            disabled={saving}
                        >
                            {saving
                                ? (isVi ? 'Đang lưu...' : 'Saving...')
                                : (isVi ? 'Hoàn tất' : 'Complete')}
                        </button>
                        <button className="ob-btn skip" onClick={handleSkip}>
                            {isVi ? 'Bỏ qua' : 'Skip for now'}
                        </button>
                    </div>
                </div>

                <style>{`
                    .ob-overlay {
                        position: fixed;
                        inset: 0;
                        z-index: 10000;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: rgba(0, 0, 0, 0.8);
                        backdrop-filter: blur(16px);
                        animation: obFadeIn 0.3s ease-out;
                    }
                    @keyframes obFadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }

                    .ob-container {
                        width: 92%;
                        max-width: 420px;
                        border-radius: 24px;
                        padding: 36px 32px 28px;
                        background: linear-gradient(180deg, rgba(30,30,38,0.98) 0%, rgba(18,18,24,0.99) 100%);
                        border: 1px solid rgba(255,255,255,0.08);
                        box-shadow:
                            0 32px 80px rgba(0,0,0,0.6),
                            0 0 0 1px rgba(255,255,255,0.04) inset,
                            0 0 60px rgba(16,185,129,0.06);
                        animation: obSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                        font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
                    }
                    @keyframes obSlideUp {
                        from { opacity: 0; transform: translateY(24px) scale(0.96); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }

                    .ob-header {
                        text-align: center;
                        margin-bottom: 28px;
                    }
                    .ob-icon {
                        font-size: 40px;
                        margin-bottom: 8px;
                        animation: obWave 1.5s ease-in-out infinite;
                    }
                    @keyframes obWave {
                        0%, 100% { transform: rotate(0deg); }
                        25% { transform: rotate(20deg); }
                        75% { transform: rotate(-10deg); }
                    }
                    .ob-title {
                        font-size: 24px;
                        font-weight: 700;
                        color: white;
                        margin: 0 0 6px;
                        letter-spacing: -0.3px;
                    }
                    .ob-subtitle {
                        font-size: 14px;
                        color: rgba(255,255,255,0.5);
                        margin: 0;
                        line-height: 1.5;
                    }

                    .ob-form {
                        display: flex;
                        flex-direction: column;
                        gap: 18px;
                    }
                    .ob-field {
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                    }
                    .ob-label {
                        font-size: 13px;
                        font-weight: 500;
                        color: rgba(255,255,255,0.7);
                    }
                    .ob-required {
                        color: #f87171;
                    }
                    .ob-optional {
                        font-weight: 400;
                        color: rgba(255,255,255,0.3);
                        font-size: 11px;
                    }

                    .ob-input, .ob-select {
                        width: 100%;
                        padding: 12px 14px;
                        border-radius: 12px;
                        border: 1px solid rgba(255,255,255,0.1);
                        background: rgba(255,255,255,0.04);
                        color: white;
                        font-size: 14px;
                        outline: none;
                        box-sizing: border-box;
                        transition: all 0.2s;
                        font-family: inherit;
                    }
                    .ob-input:focus, .ob-select:focus {
                        border-color: rgba(16,185,129,0.5);
                        box-shadow: 0 0 0 3px rgba(16,185,129,0.1);
                    }
                    .ob-input::placeholder {
                        color: rgba(255,255,255,0.25);
                    }

                    .ob-select {
                        appearance: none;
                        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
                        background-repeat: no-repeat;
                        background-position: right 14px center;
                        padding-right: 36px;
                        cursor: pointer;
                    }
                    .ob-select option {
                        background: #1a1a24;
                        color: white;
                        padding: 8px;
                    }

                    .ob-error {
                        font-size: 12px;
                        color: #f87171;
                        margin: 0;
                        padding: 8px 12px;
                        border-radius: 8px;
                        background: rgba(248,113,113,0.08);
                        border: 1px solid rgba(248,113,113,0.15);
                    }

                    .ob-actions {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        margin-top: 4px;
                    }
                    .ob-btn {
                        width: 100%;
                        padding: 13px;
                        border-radius: 12px;
                        border: none;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.25s;
                        font-family: inherit;
                    }
                    .ob-btn.primary {
                        background: linear-gradient(135deg, #10b981, #059669);
                        color: white;
                        box-shadow: 0 4px 20px rgba(16,185,129,0.3);
                    }
                    .ob-btn.primary:hover {
                        box-shadow: 0 6px 28px rgba(16,185,129,0.45);
                        transform: translateY(-1px);
                    }
                    .ob-btn.primary:disabled {
                        opacity: 0.6;
                        cursor: wait;
                        transform: none;
                    }
                    .ob-btn.skip {
                        background: transparent;
                        color: rgba(255,255,255,0.4);
                        font-weight: 500;
                    }
                    .ob-btn.skip:hover {
                        color: rgba(255,255,255,0.7);
                        background: rgba(255,255,255,0.04);
                    }
                `}</style>
            </div>
        </div>
    );
}
