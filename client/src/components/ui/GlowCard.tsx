import React from "react";
import { motion } from "framer-motion";

interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}

export const GlowCard: React.FC<GlowCardProps> = ({
  children,
  className = "",
  glowColor = "rgba(59, 130, 246, 0.2)",
}) => {
  return (
    <motion.div
      whileHover={{ scale: 1.015, translateY: -2 }}
      transition={{ duration: 0.2 }}
      className={`relative overflow-hidden rounded-2xl border border-white/20 bg-white/70 backdrop-blur-md p-5 shadow-lg transition-all duration-300 hover:shadow-xl dark:border-white/10 dark:bg-slate-900/70 ${className}`}
      style={{
        boxShadow: `0 10px 30px -10px ${glowColor}`,
      }}
    >
      <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />
      {children}
    </motion.div>
  );
};

export default GlowCard;
