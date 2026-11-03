"use client";

/**
 * Background stars behind the cosmos canvas (docs/design/cosmos.md 2.2): a separate
 * screen-space canvas so the graph is not redrawn when stars move. Seeded sky, slow
 * drift, a few twinkling stars, 0.08 parallax with the graph pan, 30fps cap, paused
 * while the tab is hidden, a single still frame under reduced motion.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { makeStars, STAR_DRIFT, STAR_PARALLAX, wrap } from "./cosmos-model";

const FRAME_MS = 1000 / 30;

export function StarField({
  width,
  height,
  reducedMotion,
  pan,
}: {
  width: number;
  height: number;
  reducedMotion: boolean;
  /** Current graph pan in screen px (read every frame; updated by the caller). */
  pan: { current: { x: number; y: number } };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Re-scatter on resize, debounced 200ms.
  const [size, setSize] = useState({ width, height });
  useEffect(() => {
    const t = setTimeout(() => setSize({ width, height }), 200);
    return () => clearTimeout(t);
  }, [width, height]);
  const stars = useMemo(
    () => (size.width > 0 && size.height > 0 ? makeStars(size.width, size.height) : []),
    [size],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || width === 0 || height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const start = performance.now();
    const draw = (now: number) => {
      const t = reducedMotion ? 0 : (now - start) / 1000;
      const px = reducedMotion ? 0 : pan.current.x * STAR_PARALLAX;
      const py = reducedMotion ? 0 : pan.current.y * STAR_PARALLAX;
      ctx.clearRect(0, 0, width, height);
      for (const s of stars) {
        const x = wrap(s.x + STAR_DRIFT.x * t + px, width);
        const y = wrap(s.y + STAR_DRIFT.y * t + py, height);
        let alpha = s.alpha;
        if (s.twinkle && !reducedMotion) {
          alpha += 0.15 * Math.sin((2 * Math.PI * t) / s.twinkle + s.phase);
        }
        ctx.globalAlpha = Math.min(1, Math.max(0, alpha));
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    if (reducedMotion) {
      draw(start);
      return;
    }

    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < FRAME_MS) return;
      last = now;
      draw(now);
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [stars, width, height, reducedMotion, pan]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ width, height }}
    />
  );
}
