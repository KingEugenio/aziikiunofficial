/**
 * Resizes and re-encodes an uploaded image before it's ever turned into a
 * data URL and stored. A logo only ever needs to display at a few dozen to
 * a couple hundred pixels (invoice headers, the sidebar avatar) - there's
 * no reason to keep a multi-megabyte, multi-thousand-pixel photo straight
 * from a phone camera. This typically takes a 3-8MB photo down to well
 * under 100KB, which is the difference between "kilobytes" and "megabytes"
 * per record that was explicitly asked for.
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

  const { width, height } = img;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // Canvas unavailable for some reason - fall back to the original
    // rather than fail the upload outright.
    return dataUrl;
  }
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // PNG for images that likely need transparency (most uploaded logos),
  // JPEG (which compresses far better) for anything else, e.g. a photo
  // used as a logo.
  const usePng = file.type === "image/png" || file.type === "image/svg+xml";
  const compressed = usePng
    ? canvas.toDataURL("image/png")
    : canvas.toDataURL("image/jpeg", 0.82);

  // Guard against the rare case where re-encoding actually produced
  // something larger (can happen with already-small, already-optimized
  // images) - use whichever is genuinely smaller.
  return compressed.length < dataUrl.length ? compressed : dataUrl;
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
