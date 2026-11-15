import React from 'react';

export interface BrandLogoProps {
  className?: string;
  tone?: 'auto' | 'dark-surface' | 'light-surface';
  showWordmark?: boolean;
  wordmarkClassName?: string;
  badgeText?: string;
}

/**
 * Official LearnMate folded-ribbon monogram (Royal Blue #2563EB -> Violet #7C3AED -> Emerald #00A86B).
 * Zero container backdrop or blur — only the crisp scalable vector ribbon mark.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = 'w-8 h-7',
  tone = 'auto',
  showWordmark = false,
  wordmarkClassName = 'font-display font-semibold text-base tracking-[-0.02em]',
  badgeText,
}) => {
  const uid = React.useId().replace(/:/g, '');
  const leftGradId = `lm-ribbon-left-${uid}`;
  const foldGradId = `lm-ribbon-fold-${uid}`;
  const rightGradId = `lm-ribbon-right-${uid}`;

  const wordmarkToneClass =
    tone === 'dark-surface'
      ? 'text-[#F8FAFC]'
      : tone === 'light-surface'
      ? 'text-[#0F172A]'
      : 'text-[#0F172A] dark:text-[#F8FAFC]';

  return (
    <span className={`inline-flex items-center gap-1.5 sm:gap-2.5 shrink-0 ${wordmarkToneClass}`}>
      <svg
        viewBox="0 0 120 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={leftGradId} x1="12" y1="12" x2="54" y2="84" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="65%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <linearGradient id={foldGradId} x1="27" y1="68" x2="78" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1D4ED8" />
            <stop offset="50%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <linearGradient id={rightGradId} x1="50" y1="30" x2="106" y2="76" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="48%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#00A86B" />
          </linearGradient>
        </defs>

        {/* Inner Folded Bridge */}
        <path
          d="M27 65 C37 56, 48 39, 64 31 L79 44 C67 48, 59 61, 52 72 Z"
          fill={`url(#${foldGradId})`}
        />

        {/* Right Overhanging Arch (Violet -> Emerald) */}
        <path
          d="M54 36 C68 25, 84 26, 92 43 L106 75 C94 70, 84 70, 74 75 L61 48 C58 42, 54 41, 49 43 Z"
          fill={`url(#${rightGradId})`}
        />

        {/* Left Pillar & Sweeping Elbow (Royal Blue -> Violet) */}
        <path
          d="M36 14 C38 10, 44 10, 48 13 C52 16, 54 21, 51 27 L32 63 C38 62, 46 64, 53 71 C46 80, 36 83, 22 83 C12 83, 8 74, 13 64 L36 14 Z"
          fill={`url(#${leftGradId})`}
        />
      </svg>

      {showWordmark && (
        <span className="inline-flex items-baseline gap-1.5 min-w-0">
          <span className={wordmarkClassName}>LearnMate</span>
          {badgeText && (
            <span className="hidden sm:inline text-[11px] font-medium text-[#475569] dark:text-[#94A3B8]">
              {badgeText}
            </span>
          )}
        </span>
      )}
    </span>
  );
};
