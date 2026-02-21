import { useState, useEffect } from 'react';
import { addToBlocklist, removeFromBlocklist, getBlocklist, type BlockedSite } from '../storage/blocklist';

// ── SVG Icons ──

const RocketIcon = () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
);

const ShieldIcon = () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
    </svg>
);

const CheckCircleIcon = () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);

// ── Default distraction sites for onboarding ──

const ONBOARDING_SITES = [
    { domain: 'facebook.com', label: 'Facebook', checked: true },
    { domain: 'youtube.com', label: 'YouTube', checked: true },
    { domain: 'twitter.com', label: 'Twitter / X', checked: true },
    { domain: 'reddit.com', label: 'Reddit', checked: true },
    { domain: 'instagram.com', label: 'Instagram', checked: false },
    { domain: 'tiktok.com', label: 'TikTok', checked: false },
    { domain: 'twitch.tv', label: 'Twitch', checked: false },
    { domain: 'pinterest.com', label: 'Pinterest', checked: false },
];

// ── Step 1: Welcome ──

function WelcomeStep({ onNext }: { onNext: () => void }) {
    return (
        <div className="onboarding-step">
            <div className="onboarding-icon"><RocketIcon /></div>
            <h2 className="onboarding-heading">Welcome to Amo Lofi</h2>
            <p className="onboarding-sub">
                Your New Tab is now a <strong>Sanctuary</strong>.<br />
                A calm space for deep focus and creative flow.
            </p>
            <button className="onboarding-cta" onClick={onNext}>
                Get Started
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                </svg>
            </button>
        </div>
    );
}

// ── Step 2: Blocklist ──

function BlocklistStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
    const [selections, setSelections] = useState(
        ONBOARDING_SITES.map((s) => ({ ...s })),
    );

    const toggle = (domain: string) => {
        setSelections((prev) =>
            prev.map((s) => (s.domain === domain ? { ...s, checked: !s.checked } : s)),
        );
    };

    const handleSave = async () => {
        // Remove all defaults first, then add selected ones
        const existing = await getBlocklist();
        for (const site of existing) {
            await removeFromBlocklist(site.domain);
        }
        for (const site of selections) {
            if (site.checked) {
                await addToBlocklist(site.domain);
            }
        }
        onNext();
    };

    return (
        <div className="onboarding-step">
            <div className="onboarding-icon"><ShieldIcon /></div>
            <h2 className="onboarding-heading">What distracts you?</h2>
            <p className="onboarding-sub">
                These sites will be gently blocked during Focus sessions.
            </p>
            <div className="onboarding-checklist">
                {selections.map((site) => (
                    <label key={site.domain} className="onboarding-check-item">
                        <div
                            className={`onboarding-checkbox ${site.checked ? 'checked' : ''}`}
                            onClick={() => toggle(site.domain)}
                        >
                            {site.checked && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            )}
                        </div>
                        <span>{site.label}</span>
                    </label>
                ))}
            </div>
            <div className="onboarding-actions">
                <button className="onboarding-skip" onClick={onSkip}>Skip</button>
                <button className="onboarding-cta" onClick={handleSave}>
                    Save
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

// ── Step 3: Done ──

function DoneStep({ onFinish }: { onFinish: () => void }) {
    return (
        <div className="onboarding-step">
            <div className="onboarding-icon done"><CheckCircleIcon /></div>
            <h2 className="onboarding-heading">You're all set!</h2>
            <p className="onboarding-sub">
                Start a Focus session anytime.<br />
                Your Sanctuary is always here for you.
            </p>
            <button className="onboarding-cta" onClick={onFinish}>
                Enter Sanctuary
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            </button>
        </div>
    );
}

// ── Main Onboarding ──

export function Onboarding() {
    const [step, setStep] = useState(0);
    const [done, setDone] = useState<boolean | null>(null); // null = loading

    useEffect(() => {
        chrome.storage.local.get('onboardingDone').then((result) => {
            setDone(!!result.onboardingDone);
        });
    }, []);

    const finish = () => {
        chrome.storage.local.set({ onboardingDone: true });
        setDone(true);
    };

    // Still loading or already completed
    if (done === null || done === true) return null;

    const steps = [
        <WelcomeStep key="welcome" onNext={() => setStep(1)} />,
        <BlocklistStep key="blocklist" onNext={() => setStep(2)} onSkip={finish} />,
        <DoneStep key="done" onFinish={finish} />,
    ];

    return (
        <div className="onboarding-overlay">
            <div className="onboarding-card">
                {steps[step]}
                {/* Step dots */}
                <div className="onboarding-dots">
                    {steps.map((_, i) => (
                        <span
                            key={i}
                            className={`onboarding-dot ${i === step ? 'active' : ''} ${i < step ? 'completed' : ''}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
