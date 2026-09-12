import React from "react";
import { InstagramLogo, FacebookLogo, TiktokLogo } from "@phosphor-icons/react";
import { useSiteSettings } from "../lib/siteSettings";

interface FooterProps {
  onShowPrivacyPolicy: () => void;
  onShowTermsOfService: () => void;
  onGoToHelp?: () => void;
}

// Matches migration 0047's seed values - shown immediately even before
// that migration has run, or before an admin has edited them from
// /admin -> Site Content. Once either happens, the fetched values (if
// non-empty) take over.
const FALLBACK_LINKS = {
  social_instagram: "https://www.instagram.com/aziiki_ghana?stkn=MWd2dnkzdjR3NnFrMA==",
  social_facebook: "https://www.facebook.com/profile.php?id=61593918316440",
  social_tiktok: "https://www.tiktok.com/@aziiki_ghana?_r=1&_t=ZS-99dUCkpD38H",
};

export default function Footer({ onShowPrivacyPolicy, onShowTermsOfService, onGoToHelp }: FooterProps) {
  const { settings } = useSiteSettings();
  const links = {
    ...FALLBACK_LINKS,
    ...Object.fromEntries(Object.entries(settings).filter(([, v]) => v.trim() !== "")),
  };

  const socialLinks = [
    { key: "social_instagram", label: "Instagram", icon: InstagramLogo },
    { key: "social_facebook", label: "Facebook", icon: FacebookLogo },
    { key: "social_tiktok", label: "TikTok", icon: TiktokLogo },
  ];

  return (
    <footer className="mt-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-2xl flex flex-col justify-between items-center gap-6 text-xs shadow-sm shadow-slate-100/10">
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="font-sans text-slate-500 dark:text-slate-400 space-y-1 text-center sm:text-left">
          <p>© 2026 Aziiki. Your Business. Organized.</p>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 text-[11px]">
            {onGoToHelp && (
              <button type="button" onClick={onGoToHelp} className="hover:text-emerald-600 hover:dark:text-emerald-400 hover:underline cursor-pointer">
                Help & Support
              </button>
            )}
            <button type="button" onClick={onShowPrivacyPolicy} className="hover:text-emerald-600 hover:dark:text-emerald-400 hover:underline cursor-pointer">
              Privacy Policy
            </button>
            <button type="button" onClick={onShowTermsOfService} className="hover:text-emerald-600 hover:dark:text-emerald-400 hover:underline cursor-pointer">
              Terms of Service
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {socialLinks.map((s) => {
            const url = links[s.key];
            if (!url) return null;
            const SocialIcon = s.icon;
            return (
              <a
                key={s.key}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-emerald-50 hover:dark:bg-emerald-900/40 hover:text-emerald-600 hover:dark:text-emerald-400 hover:border-emerald-200 hover:dark:border-emerald-700 flex items-center justify-center transition-colors"
              >
                <SocialIcon className="w-4 h-4" weight="fill" />
              </a>
            );
          })}
        </div>
      </div>
    </footer>
  );
}
