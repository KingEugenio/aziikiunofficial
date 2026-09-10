/**
 * Business.logo is a single string field that historically doubled as both
 * "a short emoji glyph" (e.g. "🪡" for a preset/demo business) AND "a full
 * uploaded logo image" (a data:image/png;base64,... URI, which can run to
 * tens of thousands of characters). Anywhere that value gets rendered as
 * plain text - a <select><option>, a sidebar label - a base64 image dumps
 * as a wall of gibberish characters, because <option> elements cannot
 * render <img> tags at all (a browser limitation, not a bug that can be
 * fixed with different markup). These helpers make sure that never
 * happens: text contexts get a short fallback, and the real image is only
 * ever used inside an actual <img> element.
 */
export function isImageLogo(logo: string | undefined | null): boolean {
  if (!logo) return false;
  return logo.startsWith("data:image") || logo.startsWith("http://") || logo.startsWith("https://") || logo.startsWith("blob:");
}

/** Safe for any plain-text context (dropdown options, labels). */
export function businessLogoGlyph(business: { logo?: string; name: string }): string {
  if (isImageLogo(business.logo)) {
    return business.name?.trim()?.[0]?.toUpperCase() || "🏢";
  }
  return business.logo || "🏢";
}
