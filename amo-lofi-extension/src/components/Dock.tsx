import { useState } from 'react';

// ── SVG Icons (Lucide-inspired, 20x20) ──

const IconTimer = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2 2" />
        <path d="M5 3L2 6" />
        <path d="M22 6l-3-3" />
        <path d="M12 5V3" />
        <path d="M10 3h4" />
    </svg>
);

const IconParking = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="3" />
        <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
    </svg>
);

const IconMusic = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
    </svg>
);

const IconChat = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M8 10h.01" />
        <path d="M12 10h.01" />
        <path d="M16 10h.01" />
    </svg>
);

const IconSettings = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

// ── Dock Button ──

interface DockButtonProps {
    icon: React.ReactNode;
    label: string;
    badge?: number;
    onClick?: () => void;
    active?: boolean;
}

function DockButton({ icon, label, badge, onClick, active }: DockButtonProps) {
    return (
        <button
            className={`dock-btn ${active ? 'active' : ''}`}
            onClick={onClick}
            title={label}
        >
            <span className="dock-btn-icon">{icon}</span>
            <span className="dock-btn-label">{label}</span>
            {badge !== undefined && badge > 0 && (
                <span className="dock-badge">{badge}</span>
            )}
        </button>
    );
}

// ── Dock ──

interface Props {
    onToggleTimer?: () => void;
    timerActive?: boolean;
    onOpenMusic?: () => void;
    onOpenChat?: () => void;
    onOpenSettings?: () => void;
}

export function Dock({ onToggleTimer, timerActive, onOpenMusic, onOpenChat, onOpenSettings }: Props) {
    const [visible, setVisible] = useState(false);

    const openLofiTab = async (path = '/') => {
        const [tab] = await chrome.tabs.query({ url: 'https://lofi.amonexus.com/*' });
        if (tab?.id) {
            chrome.tabs.update(tab.id, { active: true });
        } else {
            chrome.tabs.create({ url: `https://lofi.amonexus.com${path}` });
        }
    };

    return (
        <div
            className={`dock ${visible ? 'visible' : ''}`}
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            <div className="dock-inner">
                <DockButton
                    icon={<IconTimer />}
                    label="Timer"
                    active={timerActive}
                    onClick={onToggleTimer}
                />
                <DockButton
                    icon={<IconParking />}
                    label="Parking"
                    onClick={() => { }} // Phase 4
                />
                <div className="dock-separator" />
                <DockButton
                    icon={<IconMusic />}
                    label="Mở nhạc"
                    onClick={onOpenMusic ?? (() => openLofiTab('/'))}
                />
                <DockButton
                    icon={<IconChat />}
                    label="Chat với Amo"
                    onClick={onOpenChat ?? (() => openLofiTab('/?chat=open'))}
                />
                <div className="dock-separator" />
                <DockButton
                    icon={<IconSettings />}
                    label="Settings"
                    onClick={onOpenSettings ?? (() => { })}
                />
            </div>
        </div>
    );
}
