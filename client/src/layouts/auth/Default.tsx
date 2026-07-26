import React from "react";
import AsciiBackground from "components/ui/AsciiBackground";

interface AuthIllustrationProps {
  children: React.ReactNode;
}

export const AuthIllustration: React.FC<AuthIllustrationProps> = ({ children }) => {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "#0b1437",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Space Grotesk', 'Inter', sans-serif",
      }}
    >
      {/* Full-Screen ASCII Rain Background */}
      <AsciiBackground characters="MOONESTATES0123456789$#@%&*+" color="rgba(66, 42, 251, 0.25)" fontSize={14} />

      {/* Centered Content — absolutely centered over the background */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default AuthIllustration;
