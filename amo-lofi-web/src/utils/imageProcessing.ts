/**
 * Image Processing Utilities
 *
 * Client-side image compression for background uploads.
 * Resizes to max 1920×1080, converts to WebP at 85% quality.
 * Target output: ~200-300KB per image.
 */

export interface CompressedImage {
    blob: Blob;
    base64: string;
    width: number;
    height: number;
    originalSize: number;
    compressedSize: number;
}

/**
 * Compress and resize an image file.
 *
 * @param file - Input image file (JPEG, PNG, or WebP)
 * @param maxWidth - Maximum width (default 1920)
 * @param maxHeight - Maximum height (default 1080)
 * @param quality - WebP quality 0-1 (default 0.85)
 * @returns Compressed image data with base64 string
 */
export async function compressImage(
    file: File,
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.85,
): Promise<CompressedImage> {
    // Create image bitmap for non-blocking decode
    const img = await createImageBitmap(file);

    // Calculate scaled dimensions maintaining aspect ratio
    let { width, height } = img;
    const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);

    // Use OffscreenCanvas if available, fall back to regular Canvas
    let blob: Blob;

    if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        blob = await canvas.convertToBlob({ type: 'image/webp', quality });
    } else {
        // Fallback for Safari / older browsers
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
                'image/webp',
                quality,
            );
        });
    }

    img.close();

    // Convert to base64 for Edge Function transport
    const base64 = await blobToBase64(blob);

    return {
        blob,
        base64,
        width,
        height,
        originalSize: file.size,
        compressedSize: blob.size,
    };
}

/**
 * Convert a Blob to base64 string (without data URI prefix).
 */
async function blobToBase64(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Validate an image file before processing.
 *
 * @throws Error if validation fails
 */
export function validateImageFile(file: File, maxSizeMB = 10): void {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error(`Unsupported file type: ${file.type}. Use JPG, PNG, or WebP.`);
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
        throw new Error(
            `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${maxSizeMB}MB.`,
        );
    }
}
