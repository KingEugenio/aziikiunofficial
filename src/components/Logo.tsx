import React from "react";

interface LogoProps {
  className?: string;
  size?: number;
}

export default function Logo({ className = "", size = 36 }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1000 1000"
      width={size}
      height={size}
      className={className}
    >
      {/* Circle background in the app's brand green */}
      <circle cx="500" cy="500" r="490" fill="#006837" />

      {/* Two thin curved antennae - drawn as separate strokes, not fused
          into the head outline, matching the official mark's simpler,
          cleaner silhouette. */}
      <path
        d="M 430,330 C 400,260 360,215 320,205"
        fill="none"
        stroke="#ffffff"
        strokeWidth="26"
        strokeLinecap="round"
      />
      <path
        d="M 570,330 C 600,260 640,215 680,205"
        fill="none"
        stroke="#ffffff"
        strokeWidth="26"
        strokeLinecap="round"
      />

      {/* Rounded head/body silhouette */}
      <path
        fill="#ffffff"
        d="M 500,300
           C 610,300 690,385 690,510
           C 690,650 605,745 500,745
           C 395,745 310,650 310,510
           C 310,385 390,300 500,300
           Z"
      />

      {/* Eyes - white ovals with a centered dark pupil, looking forward */}
      <ellipse cx="435" cy="500" rx="52" ry="58" fill="#ffffff" stroke="#006837" strokeWidth="14" />
      <ellipse cx="565" cy="500" rx="52" ry="58" fill="#ffffff" stroke="#006837" strokeWidth="14" />
      <circle cx="435" cy="508" r="22" fill="#006837" />
      <circle cx="565" cy="508" r="22" fill="#006837" />
    </svg>
  );
}
