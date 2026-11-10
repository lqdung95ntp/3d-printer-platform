/**
 * Helper utility to create rounded favicons using an offscreen canvas.
 * Web browsers natively render raw bitmap pixels for tab icons without applying
 * CSS border-radius. This helper produces a crisp PNG data URL with rounded corners
 * (squircle / modern app icon curve) so custom thumbnails and avatars appear smoothly
 * rounded on all browser tabs.
 */

const faviconCache = new Map<string, string>();

export async function createRoundedFavicon(
  src: string,
  radiusRatio = 0.22,
  size = 64
): Promise<string> {
  if (typeof document === 'undefined') return src;
  if (!src) return src;

  // If already a rounded data URL or SVG progress indicator, leave untouched
  if (src.startsWith('data:image/svg+xml')) return src;

  const cacheKey = `${src}_${radiusRatio}_${size}`;
  const cached = faviconCache.get(cacheKey);
  if (cached) return cached;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }

        const radius = Math.round(size * radiusRatio);

        ctx.clearRect(0, 0, size, size);
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(0, 0, size, size, radius);
        } else {
          ctx.moveTo(radius, 0);
          ctx.arcTo(size, 0, size, size, radius);
          ctx.arcTo(size, size, 0, size, radius);
          ctx.arcTo(0, size, 0, 0, radius);
          ctx.arcTo(0, 0, size, 0, radius);
          ctx.closePath();
        }
        ctx.clip();
        ctx.drawImage(img, 0, 0, size, size);

        const dataUrl = canvas.toDataURL('image/png');
        faviconCache.set(cacheKey, dataUrl);
        resolve(dataUrl);
      } catch {
        resolve(src);
      }
    };

    img.onerror = () => {
      resolve(src);
    };

    img.src = src;
  });
}

