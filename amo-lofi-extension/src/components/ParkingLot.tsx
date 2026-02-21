import { useState, useEffect } from 'react';
import { getParkingLot, clearParkingLot, removeFromParkingLot, type ParkedSite } from '../storage/parkingLot';
import { useTimerState } from '../hooks/useTimerState';

const ParkingIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="3" />
        <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
    </svg>
);

const ExternalLinkIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
);

const TrashIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
);

interface Props {
    visible: boolean;
    onClose: () => void;
}

export function ParkingLot({ visible, onClose }: Props) {
    const [sites, setSites] = useState<ParkedSite[]>([]);
    const timer = useTimerState();
    const isBreak = timer.mode === 'break';

    // Load parking lot
    useEffect(() => {
        getParkingLot().then(setSites);

        const listener = (
            changes: { [key: string]: chrome.storage.StorageChange },
            area: string,
        ) => {
            if (area === 'local' && changes.parkingLot) {
                setSites((changes.parkingLot.newValue as ParkedSite[]) || []);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    if (!visible) return null;

    return (
        <div className={`parking-panel ${isBreak ? 'break-highlight' : ''}`}>
            {/* Header */}
            <div className="parking-header">
                <div className="parking-title">
                    <ParkingIcon />
                    <span>Parking Lot</span>
                    {sites.length > 0 && (
                        <span className="parking-count">{sites.length}</span>
                    )}
                </div>
                <button className="parking-close" onClick={onClose}>×</button>
            </div>

            {/* Break hint */}
            {isBreak && sites.length > 0 && (
                <p className="parking-hint">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px' }}>
                        <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
                        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
                        <line x1="6" x2="6" y1="2" y2="4" />
                        <line x1="10" x2="10" y1="2" y2="4" />
                        <line x1="14" x2="14" y1="2" y2="4" />
                    </svg>
                    {' '}Break time — visit these guilt-free!
                </p>
            )}

            {/* Site list */}
            {sites.length === 0 ? (
                <p className="parking-empty">No blocked sites yet. Start a focus session!</p>
            ) : (
                <ul className="parking-list">
                    {sites.map((site) => (
                        <li key={site.domain} className="parking-item">
                            <img
                                src={site.favicon}
                                alt=""
                                width={16}
                                height={16}
                                className="parking-favicon"
                            />
                            <span className="parking-domain">{site.domain}</span>
                            <div className="parking-actions">
                                <button
                                    className="parking-open"
                                    onClick={() => chrome.tabs.create({ url: site.url })}
                                    title="Open in new tab"
                                >
                                    <ExternalLinkIcon />
                                </button>
                                <button
                                    className="parking-remove"
                                    onClick={() => removeFromParkingLot(site.domain)}
                                    title="Remove"
                                >
                                    ×
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {/* Clear all */}
            {sites.length > 0 && (
                <button className="parking-clear" onClick={() => clearParkingLot()}>
                    <TrashIcon />
                    Clear all
                </button>
            )}
        </div>
    );
}
