/**
 * SyncIndicator — Shows "🔗 Extension connected" badge when ATOM Extension is online.
 *
 * Appears as a subtle floating badge in the bottom-left area.
 * Fades in/out smoothly based on extension presence.
 */

import type { SyncBridgeState } from '../../hooks/useSyncBridge';

interface Props {
    syncState: SyncBridgeState;
}

export function SyncIndicator({ syncState }: Props) {
    if (!syncState.isConnected || !syncState.extensionOnline) return null;

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 72,
                left: 20,
                zIndex: 50,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                borderRadius: 12,
                background: 'rgba(18, 18, 24, 0.75)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(74, 222, 128, 0.15)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 20px rgba(74, 222, 128, 0.08)',
                animation: 'syncIndicatorIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                fontFamily: 'Inter, -apple-system, sans-serif',
            }}
        >
            {/* Pulsing dot */}
            <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#4ade80',
                boxShadow: '0 0 8px rgba(74, 222, 128, 0.5)',
                animation: 'syncPulse 2s ease-in-out infinite',
            }} />

            <span style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.7)',
                letterSpacing: '0.01em',
            }}>
                🔗 Extension connected
            </span>

            {/* Sync text */}
            <span style={{
                fontSize: 10,
                color: 'rgba(74, 222, 128, 0.6)',
                fontWeight: 400,
            }}>
                Syncing
            </span>

            <style>{`
                @keyframes syncIndicatorIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes syncPulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(0.8); }
                }
            `}</style>
        </div>
    );
}
