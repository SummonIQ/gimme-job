'use client';

import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

export interface HeroInteractiveBackgroundProps {
  className?: string;
  density?: number;
}

type Rgb = readonly [number, number, number];

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

const parseRgb = (value: string): Rgb | null => {
  const parts = value
    .split(',')
    .map(v => Number(v.trim()))
    .filter(v => Number.isFinite(v));
  if (parts.length !== 3) return null;
  return [parts[0]!, parts[1]!, parts[2]!] as const;
};

const readCssRgbVar = (
  element: HTMLElement,
  name: string,
  fallback: Rgb,
): Rgb => {
  const raw = getComputedStyle(element).getPropertyValue(name).trim();
  const parsed = parseRgb(raw);
  return parsed ?? fallback;
};

export function HeroInteractiveBackground({
  className,
  density = 1,
}: HeroInteractiveBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pointerRef = useRef({ x: 0, y: 0, tx: 0, ty: 0, isActive: false });

  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setIsReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (isReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) return;

    const container = canvas.parentElement;
    if (!container) return;

    const primary = readCssRgbVar(container, '--primary-rgb', [68, 72, 238]);
    const glow = readCssRgbVar(container, '--primary-glow', [91, 94, 240]);

    const resize = () => {
      const dpr = clamp(window.devicePixelRatio ?? 1, 1, 2);
      const { width, height } = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${Math.max(1, Math.floor(width))}px`;
      canvas.style.height = `${Math.max(1, Math.floor(height))}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(1, rect.width);
      const y = (event.clientY - rect.top) / Math.max(1, rect.height);
      pointerRef.current.tx = clamp(x * 2 - 1, -1, 1);
      pointerRef.current.ty = clamp(y * 2 - 1, -1, 1);
      pointerRef.current.isActive = true;
    };

    const onPointerLeave = () => {
      pointerRef.current.isActive = false;
      pointerRef.current.tx = 0;
      pointerRef.current.ty = 0;
    };

    container.addEventListener('pointermove', onPointerMove, { passive: true });
    container.addEventListener('pointerleave', onPointerLeave, {
      passive: true,
    });

    let last = performance.now();

    const tick = (now: number) => {
      const dt = clamp((now - last) / 16.67, 0.5, 1.5);
      last = now;

      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      const pointer = pointerRef.current;
      const ease = pointer.isActive ? 0.06 : 0.04;
      pointer.x += (pointer.tx - pointer.x) * ease;
      pointer.y += (pointer.ty - pointer.y) * ease;

      ctx.clearRect(0, 0, width, height);

      const centerX = width * 0.5;
      const centerY = height * 0.45;

      const fieldStrength = 24;

      const glowX = centerX + pointer.x * 60;
      const glowY = centerY + pointer.y * 40;
      const glowRadius = Math.max(width, height) * 0.55;

      const glowGradient = ctx.createRadialGradient(
        glowX,
        glowY,
        0,
        glowX,
        glowY,
        glowRadius,
      );
      glowGradient.addColorStop(
        0,
        `rgba(${glow[0]}, ${glow[1]}, ${glow[2]}, 0.16)`,
      );
      glowGradient.addColorStop(
        0.55,
        `rgba(${primary[0]}, ${primary[1]}, ${primary[2]}, 0.07)`,
      );
      glowGradient.addColorStop(
        1,
        `rgba(${primary[0]}, ${primary[1]}, ${primary[2]}, 0)`,
      );

      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      ro.disconnect();
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [density, isReducedMotion]);

  if (isReducedMotion) {
    return (
      <div
        aria-hidden
        className={cn('pointer-events-none absolute inset-0', className)}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0', className)}
    />
  );
}
