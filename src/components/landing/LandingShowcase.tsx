import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import Lenis from 'lenis';
import { Moon, Sun } from 'lucide-react';
import { BrandLogo } from '../BrandLogo';
import { Screenshot3DFrame } from './Screenshot3DFrame';
import {
  FEATURE_CHAPTER_SCREENSHOTS,
  HERO_SCREENSHOT,
  LEARNMATE_APP_URL,
} from '../../data/screenshots';

gsap.registerPlugin(ScrollTrigger, useGSAP);

export interface LandingShowcaseProps {
  darkMode?: boolean;
  onToggleTheme?: () => void;
}

export const LandingShowcase: React.FC<LandingShowcaseProps> = ({
  darkMode: controlledDarkMode,
  onToggleTheme,
}) => {
  const [localDarkMode, setLocalDarkMode] = useState<boolean>(() => {
    try {
      return (
        document.documentElement.classList.contains('dark') ||
        localStorage.getItem('learnmate_theme') === 'dark'
      );
    } catch {
      return false;
    }
  });

  const isDark = controlledDarkMode !== undefined ? controlledDarkMode : localDarkMode;

  const handleToggleTheme = () => {
    if (onToggleTheme) {
      onToggleTheme();
      return;
    }
    setLocalDarkMode((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      try {
        localStorage.setItem('learnmate_theme', next ? 'dark' : 'light');
      } catch {
        // ignore storage error
      }
      return next;
    });
  };

  const containerRef = useRef<HTMLDivElement | null>(null);
  const heroStageOuterRef = useRef<HTMLDivElement | null>(null);
  const walkthroughRef = useRef<HTMLDivElement | null>(null);
  const pinnedStageRef = useRef<HTMLDivElement | null>(null);
  const stageTransitionOuterRef = useRef<HTMLDivElement | null>(null);
  const lenisRef = useRef<Lenis | null>(null);

  const [activeChapterIdx, setActiveChapterIdx] = useState<number>(0);
  const [activeScrollProgress, setActiveScrollProgress] = useState<number>(0);

  // Smooth scrolling via Lenis synced cleanly to GSAP ScrollTrigger
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    const lenis = new Lenis({
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    const onScroll = () => ScrollTrigger.update();
    lenis.on('scroll', onScroll);

    const onTick = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(onTick);
      lenis.off('scroll', onScroll);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // GSAP ScrollTrigger pinned walkthrough + outer-wrapper un-tilt/scale
  // (Never mutates inner motion/react tilt node transforms)
  useGSAP(
    () => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const mm = gsap.matchMedia();

      mm.add('(min-width: 1024px)', () => {
        if (!reducedMotion && heroStageOuterRef.current) {
          gsap.fromTo(
            heroStageOuterRef.current,
            { scale: 0.97, rotateX: 3.5 },
            {
              scale: 1,
              rotateX: 0,
              ease: 'none',
              scrollTrigger: {
                trigger: heroStageOuterRef.current,
                start: 'top 90%',
                end: 'top 30%',
                scrub: 0.5,
              },
            }
          );
        }

        if (walkthroughRef.current && pinnedStageRef.current) {
          ScrollTrigger.create({
            trigger: walkthroughRef.current,
            start: 'top top+=104',
            end: 'bottom bottom-=104',
            pin: pinnedStageRef.current,
            pinSpacing: false,
            onUpdate: (self) => {
              setActiveScrollProgress(self.progress);
            },
          });
        }

        const chapterEls = gsap.utils.toArray<HTMLElement>('[data-scroll-chapter]');
        chapterEls.forEach((el, idx) => {
          ScrollTrigger.create({
            trigger: el,
            start: 'top 56%',
            end: 'bottom 44%',
            onEnter: () => setActiveChapterIdx(idx),
            onEnterBack: () => setActiveChapterIdx(idx),
          });
        });
      });

      return () => {
        mm.revert();
      };
    },
    { scope: containerRef }
  );

  // Animate outer wrapper cleanly when transitioning between active chapters on desktop
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!stageTransitionOuterRef.current) return;

    gsap.fromTo(
      stageTransitionOuterRef.current,
      { scale: 0.955, rotateX: 4, opacity: 0.72 },
      {
        scale: 1,
        rotateX: 0,
        opacity: 1,
        duration: 0.45,
        ease: 'power3.out',
        overwrite: 'auto',
      }
    );
  }, [activeChapterIdx]);

  const scrollToAnchor = (anchorId: string) => {
    const target = document.getElementById(anchorId);
    if (!target) return;
    if (lenisRef.current) {
      lenisRef.current.scrollTo(target, { offset: -88 });
    } else {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const activeFeature =
    FEATURE_CHAPTER_SCREENSHOTS[activeChapterIdx] || FEATURE_CHAPTER_SCREENSHOTS[0];

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-[#F8FAFF] dark:bg-[#070B14] text-[#0F172A] dark:text-[#F8FAFC] flex flex-col overflow-x-clip transition-colors duration-200"
    >
      {/* Top Navbar (3-zone contract) */}
      <header className="sticky top-0 z-40 border-b border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF]/90 dark:bg-[#070B14]/90 backdrop-blur-md">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              scrollToAnchor('top');
            }}
            className="whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] rounded-md"
          >
            <BrandLogo className="w-8 h-7" showWordmark />
          </a>

          <nav
            aria-label="Primary sections"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#475569] dark:text-[#94A3B8]"
          >
            <a
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                scrollToAnchor('features');
              }}
              className="whitespace-nowrap shrink-0 hover:text-[#0F172A] dark:hover:text-[#F8FAFC] transition-colors"
            >
              Features
            </a>
            <a
              href="#cbt"
              onClick={(e) => {
                e.preventDefault();
                scrollToAnchor('cbt');
              }}
              className="whitespace-nowrap shrink-0 hover:text-[#0F172A] dark:hover:text-[#F8FAFC] transition-colors"
            >
              CBT
            </a>
            <a
              href="#3d-lab"
              onClick={(e) => {
                e.preventDefault();
                scrollToAnchor('3d-lab');
              }}
              className="whitespace-nowrap shrink-0 hover:text-[#0F172A] dark:hover:text-[#F8FAFC] transition-colors"
            >
              3D Lab
            </a>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleToggleTheme}
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              className="w-10 h-10 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              {isDark ? (
                <Sun className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4" aria-hidden="true" />
              )}
            </button>

            <a
              href={LEARNMATE_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-brand px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0"
            >
              Open App →
            </a>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero */}
        <section className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-8 sm:pt-11 pb-12 sm:pb-16">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <h1 className="font-display font-bold text-[clamp(2.15rem,4.1vw,3.5rem)] leading-[1.06] tracking-[-0.03em] text-balance text-[#0F172A] dark:text-[#F8FAFC]">
              Your JEE Workspace, Reimagined.
            </h1>

            <p className="text-base sm:text-lg text-[#475569] dark:text-[#94A3B8] leading-relaxed">
              Notes, AI Tutor, 3D Labs, and NTA CBT mocks in one place.
            </p>

            <div className="pt-1 flex items-center justify-center">
              <a
                href={LEARNMATE_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-brand px-6 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap shrink-0"
              >
                {HERO_SCREENSHOT.ctaLabel}
              </a>
            </div>
          </div>

          {/* Centerpiece 3D Dashboard Screenshot */}
          <div className="mt-7 sm:mt-9 max-w-4xl mx-auto" style={{ perspective: 1200 }}>
            <div ref={heroStageOuterRef} className="lg:will-change-transform">
              <Screenshot3DFrame
                src={HERO_SCREENSHOT.src}
                alt={HERO_SCREENSHOT.alt}
                title="LearnMate JEE Workspace"
                href={HERO_SCREENSHOT.href}
                priority
              />
            </div>
          </div>
        </section>

        {/* Pinned GSAP ScrollTrigger + Lenis Walkthrough (5 Real Feature Chapters) */}
        <section
          aria-label="LearnMate JEE feature walkthrough"
          className="border-t border-[#E2E8F0] dark:border-white/[0.08] py-12 sm:py-16"
        >
          <div
            ref={walkthroughRef}
            className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:grid lg:grid-cols-12 lg:gap-12 items-start"
          >
            {/* Left Scroll Chapters */}
            <div className="lg:col-span-5 space-y-10 lg:space-y-0">
              {FEATURE_CHAPTER_SCREENSHOTS.map((chapter, idx) => {
                const isActive = idx === activeChapterIdx;
                return (
                  <article
                    key={chapter.id}
                    id={chapter.anchorId}
                    data-scroll-chapter
                    className="scroll-mt-24 lg:min-h-[56vh] flex flex-col justify-center"
                  >
                    <div
                      onClick={() => setActiveChapterIdx(idx)}
                      className={`rounded-2xl p-6 transition-colors duration-200 border ${
                        isActive
                          ? 'bg-white dark:bg-[#111827] border-[#2563EB]/40 dark:border-[#7C3AED]/50'
                          : 'bg-white/60 dark:bg-[#111827]/60 border-[#E2E8F0] dark:border-white/[0.08] hover:border-[#CBD5E1] dark:hover:border-white/[0.14]'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <h2 className="font-display font-bold text-xl sm:text-2xl tracking-[-0.02em] text-[#0F172A] dark:text-[#F8FAFC]">
                          {chapter.chapterNumber} · {chapter.title}
                        </h2>

                        <p className="text-sm sm:text-base text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                          {chapter.caption}
                        </p>

                        <div className="pt-2">
                          <a
                            href={chapter.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white whitespace-nowrap shrink-0 transition-opacity hover:opacity-95"
                            style={{ background: chapter.accentGradient }}
                          >
                            {chapter.ctaLabel}
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Inline 3D Screenshot on Tablet & Mobile (< 1024px) */}
                    <div className="mt-5 lg:hidden">
                      <Screenshot3DFrame
                        src={chapter.src}
                        alt={chapter.alt}
                        title={`${chapter.chapterNumber} · ${chapter.title}`}
                        frames={chapter.frames}
                        href={chapter.href}
                      />
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Right Desktop Pinned GSAP Stage (>= 1024px) */}
            <div className="hidden lg:block lg:col-span-7">
              <div ref={pinnedStageRef} className="pt-2">
                <div style={{ perspective: 1200 }}>
                  <div ref={stageTransitionOuterRef} className="will-change-transform">
                    <Screenshot3DFrame
                      src={activeFeature.src}
                      alt={activeFeature.alt}
                      title={`${activeFeature.chapterNumber} · ${activeFeature.title}`}
                      frames={activeFeature.frames}
                      scrollProgress={activeScrollProgress}
                      href={activeFeature.href}
                      priority
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#070B14]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <BrandLogo className="w-7 h-6" showWordmark badgeText="JEE" />

          <a
            href={LEARNMATE_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-brand-secondary px-5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0"
          >
            Launch App →
          </a>
        </div>
      </footer>
    </div>
  );
};
