import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface AsciiBackgroundProps {
  characters?: string;
  color?: string;
  fontSize?: number;
  speed?: number;
}

export const AsciiBackground: React.FC<AsciiBackgroundProps> = ({
  characters = "MOONESTATE0123456789$#@%&*+~",
  color = "rgba(59, 130, 246, 0.15)",
  fontSize = 14,
  speed = 33,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const columns = Math.floor(width / fontSize);
    const drops: number[] = Array(columns).fill(1);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    const render = () => {
      // Semi-transparent fade background for trailing ASCII rain effect
      ctx.fillStyle = "rgba(9, 13, 22, 0.12)";
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = color;
      ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = characters.charAt(Math.floor(Math.random() * characters.length));
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        ctx.fillText(text, x, y);

        if (y > height && Math.random() > 0.975) {
          drops[i] = 0;
        }

        drops[i]++;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [characters, color, fontSize, speed]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* HTML5 Canvas for ASCII Matrix Motion */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60" />

      {/* Floating Geometric Aura Orbs */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
          x: [0, 50, 0],
          y: [0, -30, 0],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-32 -left-32 h-[550px] w-[550px] rounded-full bg-gradient-to-br from-blue-600/30 via-indigo-600/20 to-transparent blur-[100px]"
      />

      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.4, 0.2],
          x: [0, -40, 0],
          y: [0, 40, 0],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-32 -right-32 h-[600px] w-[600px] rounded-full bg-gradient-to-tl from-purple-600/25 via-blue-900/20 to-transparent blur-[110px]"
      />
    </div>
  );
};

export default AsciiBackground;
