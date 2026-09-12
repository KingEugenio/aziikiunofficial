/** Hard ceiling on the stored logo size, enforced below - not just an aspiration. */
export const MAX_LOGO_BYTES = 100_000;

/** A data URL's base64 payload is ~4/3 the size of the raw bytes it encodes. */
function dataUrlByteSize(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor((base64.length * 3) / 4);
}

/**
 * Resizes and re-encodes an uploaded image before it's ever turned into a
 * data URL and stored. A logo only ever needs to display at a few dozen to
 * a couple hundred pixels (invoice headers, the sidebar avatar) - there's
 * no reason to keep a multi-megabyte, multi-thousand-pixel photo straight
 * from a phone camera. This typically takes a 3-8MB photo down to well
 * under 100KB (MAX_LOGO_BYTES), which is now an enforced ceiling: if
 * re-encoding still can't get under it even after shrinking further, this
 * throws instead of silently storing an oversized file.
 *
 * Skips recompression for files already small enough that resizing
 * wouldn't meaningfully help (a already-tiny icon someone made in a design
 * tool) - no reason to spend CPU or lose quality on something that's
 * already efficient.
 */
export async function compressImageForStorage(
  file: File,
  maxDimension = 400,
  skipIfSmallerThanBytes = 40_000
): Promise<string> {
  if (file.size <= skipIfSmallerThanBytes) {
    return fileToDataUrl(file);
  }

  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);
  const usePng = file.type === "image/png" || file.type === "image/svg+xml";

  // Try the requested size first, then progressively smaller ones if the
  // result is still over the cap - covers the rare busy/noisy image that
  // doesn't compress as well as a typical logo at the default dimension.
  const attempts = [maxDimension, 300, 200, 120];
  let best: string | null = null;

  for (const dimension of attempts) {
    const scale = Math.min(1, dimension / Math.max(img.width, img.height));
    const targetWidth = Math.round(img.width * scale);
    const targetHeight = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) break; // Canvas unavailable - fall through to the error below.

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    const compressed = usePng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.82);

    if (!best || compressed.length < best.length) best = compressed;
    if (dataUrlByteSize(compressed) <= MAX_LOGO_BYTES) return compressed;
  }

  // Nothing got under the cap - don't silently store an oversized file.
  throw new Error(`Couldn't compress this image below ${Math.round(MAX_LOGO_BYTES / 1000)}KB - try a smaller or simpler source image.`);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for resizing."));
    img.src = src;
  });
}
