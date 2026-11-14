import React from 'react';

export interface BrandLogoProps {
  className?: string;
  tone?: 'auto' | 'dark-surface' | 'light-surface';
  showWordmark?: boolean;
  wordmarkClassName?: string;
  badgeText?: string;
}

/**
 * Official LearnMate folded-ribbon monogram (Warm Cream / Deep Charcoal + Terracotta Fold).
 * Zero container backdrop or blur — only the pure vector ribbon mark.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = 'w-8 h-7',
  tone = 'auto',
  showWordmark = false,
  wordmarkClassName = 'font-display font-semibold text-base tracking-[-0.02em]',
  badgeText,
}) => {
  const uid = React.useId().replace(/:/g, '');
  const gradId = `lm-terracotta-${uid}`;

  const primaryColorClass =
    tone === 'dark-surface'
      ? 'text-[#F5F0E6]'
      : tone === 'light-surface'
      ? 'text-[#1C1917]'
      : 'text-[#1C1917] dark:text-[#F5F0E6]';

  return (
    <span className={`inline-flex items-center gap-1.5 sm:gap-2.5 shrink-0 ${primaryColorClass}`}>
      <svg
        viewBox="0 0 120 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="28" y1="68" x2="80" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D4653B" />
            <stop offset="100%" stopColor="#E07348" />
          </linearGradient>
        </defs>

        {/* Inner Terracotta Burnt-Orange Fold */}
        <path
          d="M27 65 C37 56, 48 39, 64 31 L79 44 C67 48, 59 61, 52 72 Z"
          fill={`url(#${gradId})`}
        />

        {/* Right Overhanging Ribbon Arch */}
        <path
          d="M54 36 C68 25, 84 26, 92 43 L106 75 C94 70, 84 70, 74 75 L61 48 C58 42, 54 41, 49 43 Z"
          fill="currentColor"
        />

        {/* Left Folded Pillar & Sweeping Bottom Elbow */}
        <path
          d="M36 14 C38 10, 44 10, 48 13 C52 16, 54 21, 51 27 L32 63 C38 62, 46 64, 53 71 C46 80, 36 83, 22 83 C12 83, 8 74, 13 64 L36 14 Z"
          fill="currentColor"
        />
      </svg>

      {showWordmark && (
        <span className="inline-flex items-baseline gap-1.5 min-w-0">
          <span className={wordmarkClassName}>LearnMate</span>
          {badgeText && (
            <span className="hidden sm:inline text-[11px] font-mono text-[#57534E] dark:text-[#A1A1AA]">
              {badgeText}
            </span>
          )}
        </span>
      )}
    </span>
  );
};
