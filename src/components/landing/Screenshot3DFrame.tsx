import React, { useEffect, useState } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import { Maximize2, X } from 'lucide-react';
import { ScrollFrameCanvas } from './ScrollFrameCanvas';
import { LEARNMATE_APP_URL } from '../../data/screenshots';

export interface Screenshot3DFrameProps {
  src: string;
  alt: string;
  title: string;
  frames?: string[];
  scrollProgress?: number;
  priority?: boolean;
  href?: string;
}

/**
 * Interactive 3D perspective stage using motion/react pointer tilt + subtle
 * Royal Blue -> Violet -> Emerald ambient edge glow and click-to-zoom lightbox.
 * Motion transforms live exclusively on this inner frame so outer GSAP wrappers
 * never conflict on the same DOM element.
 */
export const Screenshot3DFrame: React.FC<Screenshot3DFrameProps> = ({
  src,
  alt,
  title,
  frames,
  scrollProgress = 0,
  priority = false,
  href = LEARNMATE_APP_URL,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [zoomOpen, setZoomOpen] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const smoothX = useSpring(mouseX, { stiffness: 180, damping: 24, mass: 0.5 });
  const smoothY = useSpring(mouseY, { stiffness: 180, damping: 24, mass: 0.5 });

  const rotateX = useTransform(smoothY, [-0.5, 0.5], [5.5, -5.5]);
  const rotateY = useTransform(smoothX, [-0.5, 0.5], [-6.5, 6.5]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || e.pointerType === 'touch') return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(nx);
    mouseY.set(ny);
  };

  const handlePointerLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  useEffect(() => {
    if (!zoomOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zoomOpen]);

  return (
    <>
      <div
        className="relative group"
        style={{ perspective: 1200 }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {/* Subtle Blue -> Violet -> Emerald ambient edge glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-2 rounded-[26px] opacity-40 dark:opacity-55 blur-xl transition-opacity duration-300 group-hover:opacity-75"
          style={{
            background:
              'linear-gradient(135deg, rgba(37,99,235,0.22) 0%, rgba(124,58,237,0.2) 52%, rgba(0,168,107,0.18) 100%)',
          }}
        />

        <motion.div
          style={
            prefersReducedMotion
              ? undefined
              : {
                  rotateX,
                  rotateY,
                  transformStyle: 'preserve-3d',
                }
          }
          whileHover={prefersReducedMotion ? undefined : { scale: 1.01 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] overflow-hidden shadow-[0_24px_60px_-20px_rgba(15,23,42,0.16)] dark:shadow-[0_28px_70px_-20px_rgba(0,0,0,0.68)]"
        >
          {/* Minimal Chrome Header */}
          <div className="px-3.5 py-2.5 border-b border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#0D1322] flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              <span className="w-2.5 h-2.5 rounded-full bg-[#CBD5E1] dark:bg-white/15" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#CBD5E1] dark:bg-white/15" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#CBD5E1] dark:bg-white/15" />
            </div>

            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              aria-label={`Inspect ${title} fullscreen`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#E2E8F0]/60 dark:hover:bg-white/[0.06] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Zoom</span>
            </button>
          </div>

          {/* Clickable Real Screenshot Surface */}
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            aria-label={`Open full preview of ${title}`}
            className="block w-full text-left cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
          >
            <ScrollFrameCanvas
              frames={frames}
              progress={scrollProgress}
              fallbackSrc={src}
              alt={alt}
              className={priority ? 'will-change-transform' : ''}
            />
          </button>
        </motion.div>
      </div>

      {/* Click-to-Zoom Lightbox */}
      {zoomOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} full preview`}
          onClick={() => setZoomOpen(false)}
          className="fixed inset-0 z-50 bg-[#070B14]/85 backdrop-blur-sm p-4 sm:p-8 flex flex-col items-center justify-center gap-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-6xl rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.1] overflow-hidden shadow-2xl"
          >
            <div className="px-4 py-3 border-b border-[#E2E8F0] dark:border-white/[0.08] flex items-center justify-between gap-4">
              <span className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                {title}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-brand px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
                >
                  Open LearnMate →
                </a>
                <button
                  type="button"
                  onClick={() => setZoomOpen(false)}
                  aria-label="Close preview"
                  className="p-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.1] text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="max-h-[80vh] overflow-auto bg-[#F8FAFF] dark:bg-[#070B14]">
              <img
                src={src}
                alt={alt}
                referrerPolicy="no-referrer"
                className="w-full h-auto block"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
