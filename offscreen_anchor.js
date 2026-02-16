/**
 * SRQ Offscreen Anchor Processor
 *
 * Handles SRQ_COMPRESS_THUMBNAIL messages from the service worker.
 * Uses canvas to resize and compress screenshots to WebP thumbnails.
 *
 * This runs in an offscreen document context (has DOM access).
 */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type !== 'SRQ_COMPRESS_THUMBNAIL') return false;

    (async () => {
        try {
            const { dataUrl, maxWidth, maxHeight, maxBytes } = msg;
            if (!dataUrl) {
                sendResponse({ ok: false, error: 'No dataUrl provided' });
                return;
            }
            const result = await compressImage(
                dataUrl,
                maxWidth || 200,
                maxHeight || 120,
                maxBytes || 50 * 1024
            );
            sendResponse({ ok: true, thumbnail: result });
        } catch (err) {
            sendResponse({ ok: false, error: err.message || 'Compression failed' });
        }
    })();
    return true;
});

/**
 * Compress a screenshot data URL to a thumbnail.
 *
 * @param {string} dataUrl - Full screenshot data URL (PNG)
 * @param {number} maxW - Maximum width (default 200)
 * @param {number} maxH - Maximum height (default 120)
 * @param {number} maxBytes - Maximum file size in bytes (default 50KB)
 * @returns {Promise<string>} Compressed WebP data URL
 */
async function compressImage(dataUrl, maxW, maxH, maxBytes) {
    // Load image
    const img = new Image();
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = dataUrl;
    });

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    // Calculate aspect-fit dimensions
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);

    // Draw scaled image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Quality reduction loop: start at 0.7, step down by 0.1
    const DATA_URL_PREFIX_LENGTH = 'data:image/webp;base64,'.length;
    let quality = 0.7;
    let result;

    while (quality >= 0.3) {
        result = canvas.toDataURL('image/webp', quality);
        // Estimate actual byte size from base64
        const base64Length = result.length - DATA_URL_PREFIX_LENGTH;
        const bytes = Math.ceil(base64Length * 3 / 4);
        if (bytes <= maxBytes) return result;
        quality -= 0.1;
    }

    // Return best effort even if over limit
    return result;
}
