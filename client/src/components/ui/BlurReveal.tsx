import React from "react";
import { motion } from "framer-motion";

interface BlurRevealProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export const BlurReveal: React.FC<BlurRevealProps> = ({
  children,
  delay = 0,
  duration = 0.5,
  className = "",
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(10px)", y: 15 }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      transition={{ duration, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export default BlurReveal;
