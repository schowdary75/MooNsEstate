import React, { useState } from "react";
import { useNavigate } from "react-router";
import { useFormik } from "formik";
import { motion, AnimatePresence } from "framer-motion";
import DefaultAuth from "layouts/auth/Default";
import { MdOutlineRemoveRedEye, MdClose } from "react-icons/md";
import { RiEyeCloseLine } from "react-icons/ri";
import { postApi } from "services/api";
import { loginSchema } from "schema";
import { toast } from "react-toastify";
import Spinner from "components/spinner/Spinner";
import { createPortal } from "react-dom";
import { useDispatch } from "react-redux";
import { setUser } from "../../../redux/slices/localSlice";

/* ─── Shared styles ────────────────────────────────────── */
const FONT = "'Space Grotesk', 'Inter', system-ui, sans-serif";

const inputStyles = (focused: boolean): React.CSSProperties => ({
  width: "100%",
  height: "48px",
  background: "rgba(255,255,255,0.06)",
  border: focused
    ? "1.5px solid rgba(117,81,255,0.7)"
    : "1.5px solid rgba(255,255,255,0.12)",
  borderRadius: "10px",
  color: "#fff",
  fontSize: "14px",
  fontFamily: FONT,
  fontWeight: 500,
  padding: "0 16px",
  outline: "none",
  boxSizing: "border-box" as const,
  transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
  boxShadow: focused ? "0 0 0 3px rgba(117,81,255,0.15)" : "none",
});

/* ─── Input component ──────────────────────────────────── */
function AuthInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode }
) {
  const [focused, setFocused] = useState(false);
  const { icon, ...rest } = props;
  return (
    <div style={{ position: "relative" }}>
      <input
        {...rest}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
        style={{
          ...inputStyles(focused),
          paddingRight: icon ? "48px" : "16px",
        }}
      />
      {icon && (
        <div
          style={{
            position: "absolute",
            right: "16px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "rgba(255,255,255,0.35)",
            display: "flex",
            cursor: "pointer",
          }}
        >
          {icon}
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────── */
export function SignIn() {
  const [isOpen, setIsOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [isLoding, setIsLoding] = useState(false);
  const [checkBox, setCheckBox] = useState(true);
  const [showPass, setShowPass] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const openAuth = (mode: "signin" | "signup") => {
    setAuthMode(mode);
    setIsOpen(true);
  };

  const signInForm = useFormik({
    initialValues: { username: "", password: "" },
    validationSchema: loginSchema,
    onSubmit: () => handleLogin(),
  });

  const signUpForm = useFormik({
    initialValues: { firstName: "", lastName: "", email: "", password: "" },
    onSubmit: async (values) => {
      try {
        setIsLoding(true);
        const res = await postApi("api/user/register", values, true);
        if (res?.status === 200) {
          toast.success("Account created! Please sign in.");
          setAuthMode("signin");
        } else {
          toast.error(res?.response?.data?.error || "Registration failed.");
        }
      } catch {
        toast.error("Registration error.");
      } finally {
        setIsLoding(false);
      }
    },
  });

  const handleLogin = async () => {
    try {
      setIsLoding(true);
      const response = await postApi("api/user/login", signInForm.values, checkBox);
      if (response?.status === 200) {
        navigate("/superAdmin");
        toast.success("Welcome to MooNsEstate!");
        signInForm.resetForm();
        dispatch(setUser(response?.data?.user));
      } else {
        toast.error(response?.response?.data?.error || "Login Failed!");
      }
    } catch {
      toast.error("An error occurred during login.");
    } finally {
      setIsLoding(false);
    }
  };

  /* ── Label helper ── */
  const Label = ({ children }: { children: React.ReactNode }) => (
    <label
      style={{
        display: "block",
        fontSize: "13px",
        fontWeight: 600,
        color: "rgba(255,255,255,0.6)",
        marginBottom: "8px",
        fontFamily: FONT,
      }}
    >
      {children}
    </label>
  );

  /* ── Error helper ── */
  const FieldError = ({ msg }: { msg?: string }) =>
    msg ? (
      <p style={{ fontSize: "12px", color: "#f87171", marginTop: "6px", fontFamily: FONT }}>
        {msg}
      </p>
    ) : null;

  return (
    <DefaultAuth>
      {/* ═══ Hero ═══════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2.5rem" }}
      >
        {/* MooN SVG Logo */}
        <div
          style={{
            width: "270px",
            color: "white",
            filter: "drop-shadow(0 0 40px rgba(118,81,255,0.55)) brightness(1.1)",
            animation: "moonFloat 4s ease-in-out infinite",
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 150" width="100%" height="100%">
            <style>{`.ml{font-family:'Times New Roman',Times,Georgia,serif;font-weight:bold;fill:currentColor}`}</style>
            <g className="ml">
              <text x="20" y="95" fontSize="105" letterSpacing="-2">M</text>
              <text x="145" y="95" fontSize="105" letterSpacing="-2">o</text>
              <text x="238" y="95" fontSize="105" letterSpacing="-2">o</text>
              <path d="M 288 38 A 22 26 0 0 1 288 88 A 16 22 0 0 0 288 38 Z" fill="#0b1437" />
              <text x="330" y="95" fontSize="105" letterSpacing="-2">N</text>
            </g>
            <path d="M 12 128 Q 210 98 380 108" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            <g transform="translate(378,102) rotate(15) scale(0.7)">
              <polygon points="0,8 18,0 12,16 8,11 3,13 4,9" fill="currentColor" />
            </g>
          </svg>
        </div>

        {/* CTA Buttons */}
        <div style={{ display: "flex", gap: "14px" }}>
          {[
            { label: "Sign In", mode: "signin" as const, primary: true },
            { label: "Sign Up", mode: "signup" as const, primary: false },
          ].map(({ label, mode, primary }) => (
            <motion.button
              key={mode}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => openAuth(mode)}
              style={{
                padding: "13px 40px",
                borderRadius: "12px",
                background: primary
                  ? "linear-gradient(135deg, #7551FF 0%, #422AFB 100%)"
                  : "rgba(255,255,255,0.06)",
                color: "#fff",
                fontWeight: 700,
                fontSize: "13px",
                fontFamily: FONT,
                border: primary ? "none" : "1px solid rgba(255,255,255,0.15)",
                cursor: "pointer",
                letterSpacing: "0.5px",
                backdropFilter: "blur(10px)",
                boxShadow: primary ? "0 8px 28px rgba(66,42,251,0.45)" : "none",
              }}
            >
              {label}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ═══ Global styles ══════════════════════════════ */}
      <style>{`
        @keyframes moonFloat {
          0%,100% { transform: translateY(0) }
          50% { transform: translateY(-10px) }
        }
        input::placeholder { color: rgba(255,255,255,0.22) !important }
      `}</style>

      {/* ═══ Auth Modal ════════════════════════════════ */}
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
            }}
          >
            {/* ── Backdrop ── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setIsOpen(false)}
              style={{
                position: "absolute",
                inset: 0,
                background: "radial-gradient(ellipse at 30% 20%, rgba(117,81,255,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(56,189,248,0.08) 0%, transparent 50%), rgba(5,8,24,0.88)",
                backdropFilter: "blur(24px) saturate(1.4)",
              }}
            />

            {/* ── Modal Card ── */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: "relative",
                zIndex: 10,
                width: "420px",
                maxWidth: "90vw",
                boxSizing: "border-box",
                background: "linear-gradient(175deg, rgba(17,28,68,0.92) 0%, rgba(11,20,55,0.96) 100%)",
                backdropFilter: "blur(60px) saturate(1.6)",
                borderRadius: "20px",
                border: "1px solid rgba(117,81,255,0.18)",
                boxShadow: `
                  0 0 0 1px rgba(255,255,255,0.04),
                  0 24px 80px rgba(0,0,0,0.55),
                  0 0 60px rgba(66,42,251,0.12)
                `,
                overflow: "hidden",
                textAlign: "left",
              }}
            >
              {/* Gradient accent line */}
              <div style={{ height: "2px", background: "linear-gradient(90deg, #7551FF, #422AFB, #38bdf8, #422AFB, #7551FF)" }} />

              {/* Card inner */}
              <div style={{ padding: "28px 32px 32px", boxSizing: "border-box" }}>
                {/* Top row: tabs + close */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px" }}>
                  {/* Tab pills */}
                  <div
                    style={{
                      display: "flex",
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: "10px",
                      padding: "4px",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {(["signin", "signup"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setAuthMode(mode)}
                        style={{
                          padding: "9px 22px",
                          borderRadius: "7px",
                          border: "none",
                          fontFamily: FONT,
                          fontSize: "13px",
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          whiteSpace: "nowrap",
                          background:
                            authMode === mode
                              ? "linear-gradient(135deg, #7551FF, #422AFB)"
                              : "transparent",
                          color: authMode === mode ? "#fff" : "rgba(255,255,255,0.35)",
                          boxShadow:
                            authMode === mode ? "0 4px 18px rgba(66,42,251,0.4)" : "none",
                        }}
                      >
                        {mode === "signin" ? "Sign In" : "Sign Up"}
                      </button>
                    ))}
                  </div>

                  {/* Close button */}
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsOpen(false)}
                    style={{
                      width: "34px",
                      height: "34px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "8px",
                      color: "rgba(255,255,255,0.4)",
                      cursor: "pointer",
                    }}
                  >
                    <MdClose size={16} />
                  </motion.button>
                </div>

                {/* ── Form content ── */}
                <AnimatePresence mode="wait">
                  {authMode === "signin" ? (
                    <motion.form
                      key="signin"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                      onSubmit={signInForm.handleSubmit}
                    >
                      {/* Heading */}
                      <h2 style={{ margin: "0 0 4px", fontSize: "24px", fontWeight: 800, color: "#fff", fontFamily: FONT, letterSpacing: "-0.4px" }}>
                        Welcome back
                      </h2>
                      <p style={{ margin: "0 0 32px", fontSize: "14px", color: "rgba(255,255,255,0.4)", fontFamily: FONT, lineHeight: 1.5 }}>
                        Sign in to your MooNsEstate dashboard
                      </p>

                      {/* Email */}
                      <div style={{ marginBottom: "20px" }}>
                        <Label>Email address</Label>
                        <AuthInput
                          name="username"
                          type="email"
                          placeholder="you@company.com"
                          value={signInForm.values.username}
                          onChange={signInForm.handleChange}
                          onBlur={signInForm.handleBlur}
                        />
                        <FieldError msg={signInForm.touched.username ? signInForm.errors.username : undefined} />
                      </div>

                      {/* Password */}
                      <div style={{ marginBottom: "20px" }}>
                        <Label>Password</Label>
                        <AuthInput
                          name="password"
                          type={showPass ? "text" : "password"}
                          placeholder="Enter your password"
                          value={signInForm.values.password}
                          onChange={signInForm.handleChange}
                          onBlur={signInForm.handleBlur}
                          icon={
                            <span onClick={() => setShowPass(!showPass)} style={{ display: "flex" }}>
                              {showPass ? <RiEyeCloseLine size={18} /> : <MdOutlineRemoveRedEye size={18} />}
                            </span>
                          }
                        />
                        <FieldError msg={signInForm.touched.password ? signInForm.errors.password : undefined} />
                      </div>

                      {/* Remember */}
                      <label style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "28px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={checkBox}
                          onChange={e => setCheckBox(e.target.checked)}
                          style={{ accentColor: "#7551FF", width: "16px", height: "16px", cursor: "pointer", borderRadius: "4px" }}
                        />
                        <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", fontFamily: FONT }}>
                          Keep me signed in
                        </span>
                      </label>

                      {/* Submit */}
                      <motion.button
                        whileHover={{ scale: 1.015, boxShadow: "0 10px 40px rgba(66,42,251,0.55)" }}
                        whileTap={{ scale: 0.985 }}
                        type="submit"
                        disabled={isLoding}
                        style={{
                          width: "100%",
                          height: "50px",
                          borderRadius: "12px",
                          background: "linear-gradient(135deg, #7551FF 0%, #422AFB 100%)",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: "15px",
                          fontFamily: FONT,
                          border: "none",
                          cursor: isLoding ? "not-allowed" : "pointer",
                          letterSpacing: "0.3px",
                          boxShadow: "0 8px 32px rgba(66,42,251,0.45)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          opacity: isLoding ? 0.7 : 1,
                          transition: "opacity 0.2s",
                        }}
                      >
                        {isLoding ? <Spinner /> : "Sign In →"}
                      </motion.button>
                    </motion.form>
                  ) : (
                    <motion.form
                      key="signup"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      onSubmit={signUpForm.handleSubmit}
                    >
                      {/* Heading */}
                      <h2 style={{ margin: "0 0 4px", fontSize: "24px", fontWeight: 800, color: "#fff", fontFamily: FONT, letterSpacing: "-0.4px" }}>
                        Create an account
                      </h2>
                      <p style={{ margin: "0 0 32px", fontSize: "14px", color: "rgba(255,255,255,0.4)", fontFamily: FONT, lineHeight: 1.5 }}>
                        Get started with MooNsEstate CRM
                      </p>

                      {/* Name row */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                        <div>
                          <Label>First name</Label>
                          <AuthInput name="firstName" placeholder="John" value={signUpForm.values.firstName} onChange={signUpForm.handleChange} />
                        </div>
                        <div>
                          <Label>Last name</Label>
                          <AuthInput name="lastName" placeholder="Doe" value={signUpForm.values.lastName} onChange={signUpForm.handleChange} />
                        </div>
                      </div>

                      {/* Email */}
                      <div style={{ marginBottom: "20px" }}>
                        <Label>Email address</Label>
                        <AuthInput name="email" type="email" placeholder="you@company.com" value={signUpForm.values.email} onChange={signUpForm.handleChange} />
                      </div>

                      {/* Password */}
                      <div style={{ marginBottom: "28px" }}>
                        <Label>Password</Label>
                        <AuthInput
                          name="password"
                          type={showPass ? "text" : "password"}
                          placeholder="Min 8 characters"
                          value={signUpForm.values.password}
                          onChange={signUpForm.handleChange}
                          icon={
                            <span onClick={() => setShowPass(!showPass)} style={{ display: "flex" }}>
                              {showPass ? <RiEyeCloseLine size={18} /> : <MdOutlineRemoveRedEye size={18} />}
                            </span>
                          }
                        />
                      </div>

                      {/* Submit */}
                      <motion.button
                        whileHover={{ scale: 1.015, boxShadow: "0 10px 40px rgba(66,42,251,0.55)" }}
                        whileTap={{ scale: 0.985 }}
                        type="submit"
                        disabled={isLoding}
                        style={{
                          width: "100%",
                          height: "50px",
                          borderRadius: "12px",
                          background: "linear-gradient(135deg, #7551FF 0%, #422AFB 100%)",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: "15px",
                          fontFamily: FONT,
                          border: "none",
                          cursor: isLoding ? "not-allowed" : "pointer",
                          letterSpacing: "0.3px",
                          boxShadow: "0 8px 32px rgba(66,42,251,0.45)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          opacity: isLoding ? 0.7 : 1,
                          transition: "opacity 0.2s",
                        }}
                      >
                        {isLoding ? <Spinner /> : "Create Account →"}
                      </motion.button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
        </AnimatePresence>,
        document.body
      )}
    </DefaultAuth>
  );
}

export default SignIn;
