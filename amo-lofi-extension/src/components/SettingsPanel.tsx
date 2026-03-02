import React, { useState, useEffect } from 'react';
import {
    getBlocklist,
    addToBlocklist,
    removeFromBlocklist,
    toggleBlockedSite,
    type BlockedSite,
    FREE_BLOCKLIST_LIMIT,
} from '../storage/blocklist';
import { scenes, CDN_BASE, type Scene } from '../data/scenes';
import { useScene } from '../hooks/useScene';
import { useAuth } from '../hooks/useAuth';
import { useCloudBackgrounds } from '../hooks/useCloudBackgrounds';

// ── SVG Icons ──

const CloseIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const TimerIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2 2" />
        <path d="M12 5V3" />
        <path d="M10 3h4" />
    </svg>
);

const ShieldIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

const BellIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
);

const PlusIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const PaletteIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
        <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
        <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
        <circle cx="6.5" cy="12" r=".5" fill="currentColor" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
);

const UserIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

// ── Settings Section ──

function SettingsSection({ icon, title, children }: {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="settings-section">
            <div className="settings-section-header">
                {icon}
                <span>{title}</span>
            </div>
            <div className="settings-section-body">{children}</div>
        </div>
    );
}

// ── Toggle Switch ──

function Toggle({ label, checked, onChange }: {
    label: string;
    checked: boolean;
    onChange: (val: boolean) => void;
}) {
    return (
        <label className="settings-toggle">
            <span>{label}</span>
            <div
                className={`toggle-switch ${checked ? 'on' : ''}`}
                onClick={() => onChange(!checked)}
            >
                <div className="toggle-knob" />
            </div>
        </label>
    );
}

// ── Blocklist Editor ──

function BlocklistEditor() {
    const [sites, setSites] = useState<BlockedSite[]>([]);
    const [newSite, setNewSite] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        getBlocklist().then(setSites);
        const listener = (
            changes: { [key: string]: chrome.storage.StorageChange },
            area: string,
        ) => {
            if (area === 'local' && changes.blocklist) {
                setSites((changes.blocklist.newValue as BlockedSite[]) || []);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    const handleAdd = async () => {
        const domain = newSite.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
        if (!domain) return;
        const result = await addToBlocklist(domain);
        if (result.ok) {
            setNewSite('');
            setError('');
        } else if (result.reason === 'already_exists') {
            setError('Already in list');
        } else if (result.reason === 'limit_reached') {
            setError(`Free limit: ${FREE_BLOCKLIST_LIMIT} sites`);
        }
    };

    return (
        <div className="blocklist-editor">
            {sites.map((site) => (
                <div key={site.domain} className="blocklist-item">
                    <div
                        className={`toggle-switch small ${site.enabled ? 'on' : ''}`}
                        onClick={() => toggleBlockedSite(site.domain)}
                    >
                        <div className="toggle-knob" />
                    </div>
                    <span className="blocklist-domain">{site.domain}</span>
                    <button
                        className="blocklist-remove"
                        onClick={() => removeFromBlocklist(site.domain)}
                    >
                        ×
                    </button>
                </div>
            ))}
            <div className="blocklist-add">
                <input
                    type="text"
                    placeholder="Add site (e.g. tiktok.com)"
                    value={newSite}
                    onChange={(e) => { setNewSite(e.target.value); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
                <button onClick={handleAdd}><PlusIcon /></button>
            </div>
            {error && <p className="blocklist-error">{error}</p>}
        </div>
    );
}

// ── Duration Picker ──

function DurationPicker({ label, options, storageKey }: {
    label: string;
    options: number[];
    storageKey: string;
}) {
    const [value, setValue] = useState(options[1]); // default to second option

    useEffect(() => {
        chrome.storage.local.get(storageKey).then((result) => {
            if (result[storageKey]) setValue(result[storageKey] as number);
        });
    }, [storageKey]);

    const handleChange = (mins: number) => {
        setValue(mins);
        chrome.storage.local.set({ [storageKey]: mins });
    };

    return (
        <div className="duration-picker">
            <span className="duration-label">{label}</span>
            <div className="duration-options">
                {options.map((mins) => (
                    <button
                        key={mins}
                        className={`duration-btn ${value === mins ? 'active' : ''}`}
                        onClick={() => handleChange(mins)}
                    >
                        {mins}m
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── Notification Settings ──

function NotificationSettings() {
    const [notifyBreak, setNotifyBreak] = useState(true);
    const [notifyFocusDone, setNotifyFocusDone] = useState(true);

    useEffect(() => {
        chrome.storage.local.get(['notifyBreak', 'notifyFocusDone']).then((result) => {
            if (result.notifyBreak !== undefined) setNotifyBreak(result.notifyBreak as boolean);
            if (result.notifyFocusDone !== undefined) setNotifyFocusDone(result.notifyFocusDone as boolean);
        });
    }, []);

    const toggle = (key: string, val: boolean, setter: (v: boolean) => void) => {
        setter(val);
        chrome.storage.local.set({ [key]: val });
    };

    return (
        <>
            <Toggle
                label="Break reminders"
                checked={notifyBreak}
                onChange={(v) => toggle('notifyBreak', v, setNotifyBreak)}
            />
            <Toggle
                label="Focus complete"
                checked={notifyFocusDone}
                onChange={(v) => toggle('notifyFocusDone', v, setNotifyFocusDone)}
            />
        </>
    );
}

// ── Account Section ──

function AccountSection() {
    const { user, loading, error, isLoggedIn, login, logout } = useAuth();

    if (loading) {
        return <div className="account-status">Loading...</div>;
    }

    if (!isLoggedIn) {
        return (
            <div className="account-login">
                <p className="account-hint">Sign in to sync scenes across devices</p>
                <button className="account-google-btn" onClick={login}>
                    <svg width="16" height="16" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                </button>
                {error && <p className="account-error">{error}</p>}
            </div>
        );
    }

    return (
        <div className="account-info">
            <div className="account-user">
                {user?.user_metadata?.avatar_url ? (
                    <img
                        className="account-avatar"
                        src={user.user_metadata.avatar_url as string}
                        alt=""
                        width={28}
                        height={28}
                    />
                ) : (
                    <div className="account-avatar-placeholder">
                        {(user?.email?.[0] || '?').toUpperCase()}
                    </div>
                )}
                <div className="account-details">
                    <span className="account-name">
                        {(user?.user_metadata?.full_name as string) || user?.email || 'User'}
                    </span>
                    <span className="account-email">{user?.email}</span>
                </div>
            </div>
            <button className="account-logout" onClick={logout}>
                Sign out
            </button>
        </div>
    );
}

// ── Scene Picker ──

function ScenePicker() {
    const { sceneId, wallpaperId, selectScene, selectWallpaper, selectCloudBackground } = useScene();
    const { isLoggedIn } = useAuth();
    const { backgrounds: cloudBgs, loading: cloudLoading } = useCloudBackgrounds();
    const [expandedScene, setExpandedScene] = useState<string | null>(sceneId);

    const handleSceneClick = (id: string) => {
        if (sceneId === id) {
            setExpandedScene(expandedScene === id ? null : id);
        } else {
            selectScene(id);
            setExpandedScene(id);
        }
    };

    return (
        <>
            <div className="scene-picker">
                {scenes.map((scene) => (
                    <React.Fragment key={scene.id}>
                        <button
                            className={`scene-thumb ${sceneId === scene.id ? 'active' : ''}`}
                            onClick={() => handleSceneClick(scene.id)}
                            style={{
                                backgroundImage: `url(${CDN_BASE}${scene.background})`,
                            }}
                        >
                            <span
                                className="scene-thumb-label"
                                style={{ color: scene.theme.primary }}
                            >
                                {scene.name}
                            </span>
                            {sceneId === scene.id && (
                                <div
                                    className="scene-thumb-active"
                                    style={{ borderColor: scene.theme.primary }}
                                />
                            )}
                        </button>

                        {expandedScene === scene.id && scene.wallpapers.length > 1 && (
                            <div className="wallpaper-strip">
                                {scene.wallpapers.map((wp) => {
                                    const isActive =
                                        sceneId === scene.id &&
                                        (wallpaperId === wp.id || (!wallpaperId && wp.src === scene.background));
                                    return (
                                        <button
                                            key={wp.id}
                                            className={`wallpaper-thumb ${isActive ? 'active' : ''}`}
                                            onClick={() => selectWallpaper(scene.id, wp.id)}
                                            title={wp.name}
                                        >
                                            <img
                                                src={`${CDN_BASE}${wp.src}`}
                                                alt={wp.name}
                                                loading="lazy"
                                            />
                                            {isActive && (
                                                <div
                                                    className="wallpaper-thumb-active"
                                                    style={{ borderColor: scene.theme.primary }}
                                                />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Cloud Backgrounds — visible when logged in */}
            {isLoggedIn && cloudBgs.length > 0 && (
                <div className="cloud-bg-section">
                    <div className="cloud-bg-label">☁️ My Backgrounds</div>
                    <div className="cloud-bg-grid">
                        {cloudBgs.map((bg) => {
                            const isActive = wallpaperId === `cloud_${bg.id}`;
                            return (
                                <button
                                    key={bg.id}
                                    className={`cloud-bg-thumb ${isActive ? 'active' : ''}`}
                                    onClick={() => selectCloudBackground(bg.signedUrl, bg.id)}
                                    title={bg.name}
                                >
                                    <img src={bg.signedUrl} alt={bg.name} loading="lazy" />
                                    <span className="cloud-bg-badge">
                                        {bg.source === 'ai_generated' ? '✨' : '📤'}
                                    </span>
                                    {isActive && <div className="cloud-bg-active" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
            {isLoggedIn && cloudLoading && (
                <div className="cloud-bg-loading">Loading backgrounds...</div>
            )}
        </>
    );
}

// ── Main Settings Panel ──

interface Props {
    visible: boolean;
    onClose: () => void;
}

export function SettingsPanel({ visible, onClose }: Props) {
    return (
        <>
            {/* Backdrop */}
            {visible && <div className="settings-backdrop" onClick={onClose} />}

            <div className={`settings-panel ${visible ? 'open' : ''}`}>
                {/* Header */}
                <div className="settings-header">
                    <span className="settings-title">Settings</span>
                    <button className="settings-close" onClick={onClose}>
                        <CloseIcon />
                    </button>
                </div>

                {/* Timer */}
                <SettingsSection icon={<TimerIcon />} title="Timer">
                    <DurationPicker label="Focus" options={[15, 25, 30, 45, 60]} storageKey="focusDuration" />
                    <DurationPicker label="Break" options={[5, 10, 15]} storageKey="breakDuration" />
                </SettingsSection>

                {/* Blocked Sites */}
                <SettingsSection icon={<ShieldIcon />} title="Blocked Sites">
                    <BlocklistEditor />
                </SettingsSection>

                {/* Notifications */}
                <SettingsSection icon={<BellIcon />} title="Notifications">
                    <NotificationSettings />
                </SettingsSection>

                {/* Scene Picker */}
                <SettingsSection icon={<PaletteIcon />} title="Scene">
                    <ScenePicker />
                </SettingsSection>

                {/* Account */}
                <SettingsSection icon={<UserIcon />} title="Account">
                    <AccountSection />
                </SettingsSection>

                {/* Ecosystem */}
                <div className="settings-section">
                    <div className="settings-section-header">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.878.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z" />
                        </svg>
                        <span>Amo Ecosystem</span>
                    </div>
                    <div className="eco-links">
                        <a className="eco-link" href="https://lofi.amonexus.com" target="_blank" rel="noopener">
                            <span className="eco-link-emoji">🎵</span>
                            <span className="eco-link-text">
                                <strong>Amo Lofi Web</strong>
                                <small>Full experience with music & AI</small>
                            </span>
                            <span className="eco-link-arrow">→</span>
                        </a>
                    </div>
                </div>

                {/* Footer */}
                <div className="settings-footer">
                    <span className="settings-version">Amo Lofi Extension v1.5</span>
                </div>
            </div>
        </>
    );
}
