import React from "react";
import Logo from "./Logo";
import { useBranding } from "../lib/branding";

interface BrandLogoProps {
  className?: string;
  size?: number;
}

/**
 * Drop-in replacement for <Logo/> that shows the admin-uploaded logo
 * (see /admin -> Branding & Files) when one exists, falling back to the
 * built-in mark otherwise. Used at the handful of prominent, first-visible
 * spots (auth screen, main app header, admin sidebar, ...) rather than
 * every <Logo/> call site - small decorative uses elsewhere keep the
 * built-in mark on purpose.
 */
export default function BrandLogo({ className = "", size = 36 }: BrandLogoProps) {
  const { logoUrl } = useBranding();

  if (logoUrl) {
    return <img src={logoUrl} alt="Aziiki" className={className} style={{ width: size, height: size, objectFit: "contain" }} />;
  }

  return <Logo className={className} size={size} />;
}
