/**
 * TopSites — Renders a row of most-visited site shortcuts,
 * similar to Chrome's default New Tab.
 * Uses chrome.topSites.get() API + Google Favicon service.
 */

import { useState, useEffect } from 'react';

const MAX_SITES = 8;
const FAVICON_API = 'https://www.google.com/s2/favicons?domain=';

interface TopSite {
    title: string;
    url: string;
}

function getDomain(url: string): string {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return url;
    }
}

function getShortName(title: string, url: string): string {
    if (title && title.length <= 12) return title;
    const domain = getDomain(url);
    // Use first part of domain (e.g. "facebook" from "facebook.com")
    const name = domain.split('.')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
}

export function TopSites() {
    const [sites, setSites] = useState<TopSite[]>([]);

    useEffect(() => {
        if (chrome?.topSites?.get) {
            chrome.topSites.get((topSites) => {
                setSites(topSites.slice(0, MAX_SITES));
            });
        }
    }, []);

    if (sites.length === 0) return null;

    return (
        <div className="top-sites">
            {sites.map((site) => (
                <a
                    key={site.url}
                    className="top-site"
                    href={site.url}
                    title={site.title}
                >
                    <div className="top-site-icon">
                        <img
                            src={`${FAVICON_API}${getDomain(site.url)}&sz=32`}
                            alt=""
                            width={20}
                            height={20}
                            loading="lazy"
                            onError={(e) => {
                                // Fallback: show first letter
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                target.parentElement!.classList.add('fallback');
                                target.parentElement!.setAttribute(
                                    'data-letter',
                                    getDomain(site.url)[0].toUpperCase(),
                                );
                            }}
                        />
                    </div>
                    <span className="top-site-label">
                        {getShortName(site.title, site.url)}
                    </span>
                </a>
            ))}
        </div>
    );
}
