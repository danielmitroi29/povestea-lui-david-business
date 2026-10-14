import type { CSSProperties } from "react";

// ── Shared micro-styles ──────────────────────────────────────────────────────

export const cardStyle: CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(167,139,250,0.22)",
  borderRadius: 20,
  padding: "18px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.07)",
  transition: "border-color 0.2s",
};

export const cardTitleStyle: CSSProperties = {
  fontSize: "0.88rem",
  fontWeight: 700,
  color: "#a78bfa",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginTop: 0,
  marginBottom: 12,
};

export const inputStyle: CSSProperties = {
  border: "1px solid rgba(167,139,250,0.3)",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: "0.95rem",
  background: "rgba(255,255,255,0.06)",
  outline: "none",
  color: "#f0e8ff",
  fontFamily: "inherit",
  width: "100%",
};

export const smallBtnStyle: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 12,
  border: "1px solid rgba(167,139,250,0.35)",
  background: "rgba(124,58,237,0.15)",
  color: "#a78bfa",
  cursor: "pointer",
  fontSize: "0.9rem",
};

export const ttsBtnStyle = (color: string): CSSProperties => ({
  padding: "11px 20px",
  borderRadius: 50,
  border: "none",
  background: color,
  color: "white",
  cursor: "pointer",
  fontSize: "0.88rem",
  fontWeight: 700,
  minHeight: 44,
  letterSpacing: "0.02em",
  boxShadow: `0 4px 16px ${color}55`,
});
