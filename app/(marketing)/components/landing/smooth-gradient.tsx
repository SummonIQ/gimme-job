'use client';

import { useEffect, useRef } from 'react';

export function SmoothGradient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener('resize', resize);

    // Color palette - blue to purple gradient
    const colors = [
      { r: 37, g: 99, b: 235 },   // Blue-600
      { r: 99, g: 102, b: 241 },  // Indigo-500
      { r: 139, g: 92, b: 246 },  // Violet-500
      { r: 168, g: 85, b: 247 },  // Purple-500
      { r: 192, g: 132, b: 252 }, // Purple-400
    ];

    const render = () => {
      // Create smooth gradient with animated position
      const gradient = ctx.createLinearGradient(
        canvas.width * (0.3 + Math.sin(time * 0.3) * 0.2),
        canvas.height * (0.2 + Math.cos(time * 0.2) * 0.15),
        canvas.width * (0.7 + Math.cos(time * 0.4) * 0.2),
        canvas.height * (0.8 + Math.sin(time * 0.25) * 0.15)
      );

      // Animate color stops
      const offset1 = (Math.sin(time * 0.5) + 1) * 0.5;
      const offset2 = (Math.sin(time * 0.3 + 1) + 1) * 0.5;
      const offset3 = (Math.sin(time * 0.4 + 2) + 1) * 0.5;

      // Interpolate colors smoothly
      const color1 = interpolateColor(colors[0], colors[1], offset1);
      const color2 = interpolateColor(colors[1], colors[2], offset2);
      const color3 = interpolateColor(colors[2], colors[3], offset3);
      const color4 = interpolateColor(colors[3], colors[4], (offset1 + offset2) / 2);

      gradient.addColorStop(0, `rgba(${color1.r}, ${color1.g}, ${color1.b}, 0.9)`);
      gradient.addColorStop(0.33, `rgba(${color2.r}, ${color2.g}, ${color2.b}, 0.85)`);
      gradient.addColorStop(0.66, `rgba(${color3.r}, ${color3.g}, ${color3.b}, 0.85)`);
      gradient.addColorStop(1, `rgba(${color4.r}, ${color4.g}, ${color4.b}, 0.9)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add subtle radial overlays for depth
      const radial1 = ctx.createRadialGradient(
        canvas.width * (0.3 + Math.sin(time * 0.6) * 0.15),
        canvas.height * (0.3 + Math.cos(time * 0.5) * 0.15),
        0,
        canvas.width * (0.3 + Math.sin(time * 0.6) * 0.15),
        canvas.height * (0.3 + Math.cos(time * 0.5) * 0.15),
        canvas.width * 0.6
      );

      radial1.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
      radial1.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
      radial1.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = radial1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const radial2 = ctx.createRadialGradient(
        canvas.width * (0.7 + Math.cos(time * 0.4) * 0.15),
        canvas.height * (0.7 + Math.sin(time * 0.7) * 0.15),
        0,
        canvas.width * (0.7 + Math.cos(time * 0.4) * 0.15),
        canvas.height * (0.7 + Math.sin(time * 0.7) * 0.15),
        canvas.width * 0.5
      );

      radial2.addColorStop(0, 'rgba(147, 51, 234, 0.15)');
      radial2.addColorStop(0.5, 'rgba(139, 92, 246, 0.08)');
      radial2.addColorStop(1, 'rgba(99, 102, 241, 0)');

      ctx.fillStyle = radial2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      time += 0.005; // Slow, smooth animation
      animationFrame = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 size-full"
      style={{ mixBlendMode: 'normal' }}
    />
  );
}

function interpolateColor(
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number },
  factor: number
) {
  return {
    r: Math.round(color1.r + (color2.r - color1.r) * factor),
    g: Math.round(color1.g + (color2.g - color1.g) * factor),
    b: Math.round(color1.b + (color2.b - color1.b) * factor),
  };
}
