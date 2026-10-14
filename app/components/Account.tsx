"use client";

import { useState } from "react";
import { authClient } from "@/app/lib/authClient";
import { cardStyle, cardTitleStyle, inputStyle, smallBtnStyle } from "@/app/components/styles";

export interface Usage {
  used: number;
  limit: number;
  subscribed: boolean;
  periodEnd: string | null;
}

// Mesajele Better Auth vin in engleza; le traducem pe cele pe care le vede un parinte
const AUTH_ERRORS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email sau parolă greșită.",
  USER_ALREADY_EXISTS: "Există deja un cont cu acest email. Intră în cont.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Există deja un cont cu acest email. Intră în cont.",
  PASSWORD_TOO_SHORT: "Parola trebuie să aibă cel puțin 8 caractere.",
  INVALID_EMAIL: "Adresa de email nu este validă.",
};

function authError(err: { code?: string; message?: string } | null | undefined) {
  return (err?.code && AUTH_ERRORS[err.code]) || "Nu a mers. Verifică datele și încearcă din nou.";
}

/** Formularul de intrare în cont / cont nou, afișat celor neautentificați. */
export function AuthCard({ google }: { google: boolean }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = mode === "signin"
      ? await authClient.signIn.email({ email, password })
      : await authClient.signUp.email({ email, password, name: email.split("@")[0] });
    if (res.error) setError(authError(res.error));
    setBusy(false);
  };

  return (
    <div style={cardStyle}>
      <h2 style={cardTitleStyle}>{mode === "signin" ? "🔑 Intră în cont" : "🌟 Cont nou"}</h2>
      <p style={{ color: "rgba(167,139,250,0.7)", fontSize: "0.85rem", marginTop: 0, marginBottom: 14 }}>
        {mode === "signin"
          ? "Intră în cont ca să creezi și să asculți povești."
          : "Creează un cont și primești povești gratuite de încercat."}
      </p>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label htmlFor="auth-email" className="sr-only-text">Email</label>
        <input id="auth-email" type="email" required autoComplete="email" placeholder="Email"
          value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        <label htmlFor="auth-password" className="sr-only-text">Parolă</label>
        <input id="auth-password" type="password" required minLength={8}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="Parolă (minim 8 caractere)"
          value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
        {error && <div role="alert" style={{ color: "#fca5a5", fontSize: "0.85rem" }}>{error}</div>}
        <button type="submit" disabled={busy} style={primaryBtnStyle(busy)}>
          {busy ? "⏳ Un moment…" : mode === "signin" ? "Intră în cont" : "Creează contul"}
        </button>
      </form>

      {google && (
        <button
          type="button"
          onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/" })}
          style={{ ...smallBtnStyle, width: "100%", marginTop: 10, minHeight: 44 }}
        >
          Continuă cu Google
        </button>
      )}

      <button
        type="button"
        onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
        style={{ background: "none", border: "none", color: "#c4b5fd", cursor: "pointer", marginTop: 14, fontSize: "0.85rem", width: "100%", minHeight: 44 }}
      >
        {mode === "signin" ? "Nu ai cont? Creează unul" : "Ai deja cont? Intră în cont"}
      </button>
    </div>
  );
}

/** Contul curent: câte povești mai are, abonare / gestionare abonament, ieșire. */
export function AccountBar({ email, usage, billing }: { email: string; usage: Usage | null; billing: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const subscribe = async () => {
    setBusy(true);
    setError("");
    // Redirecționează la pagina de plată Stripe
    const res = await authClient.subscription.upgrade({ plan: "standard", successUrl: "/", cancelUrl: "/" });
    if (res.error) { setError("Nu am putut deschide pagina de plată."); setBusy(false); }
  };

  const manage = async () => {
    setBusy(true);
    setError("");
    // Portalul Stripe: card, facturi, anulare
    const res = await authClient.subscription.billingPortal({ returnUrl: "/" });
    if (res.error) { setError("Nu am putut deschide pagina abonamentului."); setBusy(false); }
  };

  const left = usage ? Math.max(usage.limit - usage.used, 0) : null;
  const renew = usage?.periodEnd
    ? new Date(usage.periodEnd).toLocaleDateString("ro-RO", { day: "numeric", month: "long" })
    : null;

  return (
    <div style={{ ...cardStyle, padding: "14px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ color: "#e0d0ff", fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
          👤 {email}
        </span>
        <button type="button" onClick={() => authClient.signOut().then(() => window.location.reload())} style={{ ...smallBtnStyle, fontSize: "0.8rem" }}>
          Ieșire
        </button>
      </div>

      {usage && (
        <div style={{ marginTop: 10, color: "#c4b5fd", fontSize: "0.88rem" }}>
          {usage.subscribed
            ? <>📖 Ai folosit <strong>{usage.used} din {usage.limit}</strong> povești luna aceasta{renew ? ` · se reînnoiesc pe ${renew}` : ""}.</>
            : <>🎁 Povești gratuite: <strong>{left} din {usage.limit}</strong> rămase.</>}
        </div>
      )}

      {billing && usage && (
        <div style={{ marginTop: 10 }}>
          {usage.subscribed ? (
            <button type="button" disabled={busy} onClick={manage} style={{ ...smallBtnStyle, fontSize: "0.82rem" }}>
              Gestionează abonamentul
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={subscribe} style={primaryBtnStyle(busy)}>
              {busy ? "⏳ Un moment…" : "✨ Abonează-te"}
            </button>
          )}
        </div>
      )}
      {error && <div role="alert" style={{ color: "#fca5a5", fontSize: "0.85rem", marginTop: 8 }}>{error}</div>}
    </div>
  );
}

const primaryBtnStyle = (busy: boolean): React.CSSProperties => ({
  width: "100%",
  minHeight: 46,
  borderRadius: 50,
  border: "none",
  background: busy ? "rgba(124,58,237,0.3)" : "linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #6d28d9 100%)",
  color: "white",
  fontWeight: 800,
  fontSize: "0.95rem",
  cursor: busy ? "not-allowed" : "pointer",
});
