import React, { useEffect, useRef, useState } from 'react';
import { Monitor } from 'lucide-react';

export interface ScrollFrameCanvasProps {
  /** Optional sequence of .webp frame URLs for scroll-scrubbed playback */
  frames?: string[];
  /** Normalized scroll progress in [0, 1] when frames are provided */
  progress?: number;
  /** High-resolution fallback screenshot URL when no frame sequence is supplied */
  fallbackSrc: string;
  alt: string;
  className?: string;
}

/**
 * Supports optional .webp scroll frame sequences on an HTML5 canvas while
 * defaulting cleanly to the real high-resolution app screenshot.
 */
export const ScrollFrameCanvas: React.FC<ScrollFrameCanvasProps> = ({
  frames,
  progress = 0,
  fallbackSrc,
  alt,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImagesRef = useRef<Array<HTMLImageElement | null>>([]);
  const [framesReady, setFramesReady] = useState(false);
  const [imageError, setImageError] = useState(false);

  const hasSequence = Array.isArray(frames) && frames.length > 0;

  useEffect(() => {
    setImageError(false);
  }, [fallbackSrc]);

  useEffect(() => {
    if (!hasSequence || !frames) {
      setFramesReady(false);
      return;
    }

    let cancelled = false;
    const pool: Array<HTMLImageElement | null> = new Array(frames.length).fill(null);

    frames.forEach((frameUrl, index) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        if (cancelled) return;
        pool[index] = img;
        loadedImagesRef.current = pool;
        if (index === 0) {
          setFramesReady(true);
        }
      };
      img.src = frameUrl;
    });

    return () => {
      cancelled = true;
    };
  }, [hasSequence, frames]);

  useEffect(() => {
    if (!hasSequence || !framesReady || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pool = loadedImagesRef.current;
    const clamped = Math.max(0, Math.min(1, progress));
    const idx = Math.min(pool.length - 1, Math.floor(clamped * Math.max(1, pool.length - 1)));
    const img = pool[idx] || pool.find(Boolean);
    if (!img) return;

    if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
      canvas.width = img.naturalWidth || 1440;
      canvas.height = img.naturalHeight || 900;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }, [hasSequence, framesReady, progress]);

  if (hasSequence && framesReady) {
    return (
      <canvas
        ref={canvasRef}
        aria-label={alt}
        className={`w-full h-auto block select-none ${className}`}
      />
    );
  }

  if (imageError) {
    return (
      <div
        className={`w-full aspect-[16/10] flex flex-col items-center justify-center gap-3 bg-[#F1F5F9] dark:bg-[#0F172A] text-[#475569] dark:text-[#94A3B8] p-6 text-center ${className}`}
      >
        <Monitor className="w-8 h-8 text-[#2563EB]" aria-hidden="true" />
        <p className="text-sm font-medium max-w-sm">{alt}</p>
      </div>
    );
  }

  return (
    <img
      src={fallbackSrc}
      alt={alt}
      loading="eager"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setImageError(true)}
      className={`w-full h-auto block select-none object-cover object-top ${className}`}
    />
  );
};
