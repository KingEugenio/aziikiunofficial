// Captures utm_source/utm_medium/utm_campaign from the URL on first load
// and persists them for the length of the session, so a signup completed
// later (after clicking around the marketing pages) still carries the
// campaign that brought the visitor in.

const STORAGE_KEY = "aziiki_utm_params";

export interface UtmParams {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export function captureUtmParams(): void {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source");
  const utmMedium = params.get("utm_medium");
  const utmCampaign = params.get("utm_campaign");

  if (!utmSource && !utmMedium && !utmCampaign) return;

  const captured: UtmParams = {
    ...(utmSource ? { utmSource } : {}),
    ...(utmMedium ? { utmMedium } : {}),
    ...(utmCampaign ? { utmCampaign } : {}),
  };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(captured));
  } catch {
    // sessionStorage unavailable (private mode, etc.) - just skip persistence
  }
}

export function getStoredUtmParams(): UtmParams {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
