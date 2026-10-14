"use client";

import { useState, useRef, useEffect } from "react";
import { authClient } from "@/app/lib/authClient";
import { AccountBar, AuthCard, type Usage } from "@/app/components/Account";
import { cardStyle, cardTitleStyle, inputStyle, smallBtnStyle, ttsBtnStyle } from "@/app/components/styles";

interface SavedStory {
  id: string;
  title: string;
  text: string;
  names: string[];
  createdAt: string;
}

type SpeechState = "idle" | "speaking" | "paused";

export default function Home() {
  const [names, setNames] = useState<string[]>(["", ""]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [age, setAge] = useState("");
  const [duration, setDuration] = useState("");
  const [story, setStory] = useState("");
  // Id-ul poveștii afișate; vocea se cere pe bucăți după el
  const [storyId, setStoryId] = useState<string | null>(null);
  const [storyTitle, setStoryTitle] = useState("");
  const [storyCollapsed, setStoryCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [speechState, setSpeechState] = useState<SpeechState>("idle");
  /*
   * Pre-fetch-ul primului chunk audio, tinut IMPREUNA cu povestea pentru care
   * s-a facut. Tinem si povestea in stare, nu doar rezultatul, pentru ca asa
   * "reseteaza cand apare o poveste noua" devine o derivare, nu doua setState-uri
   * in corpul efectului — care declansau un render in plus la fiecare poveste si
   * sunt semnalate ca eroare de React Compiler.
   *
   * b64 === null  → inca se incarca
   * b64 === ""    → pre-fetch esuat, se cade pe TTS-ul browserului
   */
  const [ttsChunk, setTtsChunk] = useState<{ storyId: string | null; b64: string | null; total: number }>({
    storyId: null,
    b64: null,
    total: 0,
  });
  const firstChunkB64 = storyId && ttsChunk.storyId === storyId ? ttsChunk.b64 : null;
  const ttsLoading = !!storyId && firstChunkB64 === null;
  const [aiReady, setAiReady] = useState(false);
  const [googleLogin, setGoogleLogin] = useState(false);
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const userId = session?.user.id ?? null;
  const [usage, setUsage] = useState<Usage | null>(null);
  const [billing, setBilling] = useState(false);
  // Crește după fiecare poveste nouă/ștearsă, ca să reîncarce cota și istoricul
  const [reloadKey, setReloadKey] = useState(0);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [storiesPage, setStoriesPage] = useState(0);
  const [storiesData, setStoriesData] = useState<{ userId: string | null; stories: SavedStory[]; total: number; pages: number }>(
    { userId: null, stories: [], total: 0, pages: 1 });
  // Istoricul altui cont (după ieșire/intrare) nu se afișează nici o clipă
  const mine = storiesData.userId === userId;
  const savedStories = mine ? storiesData.stories : [];
  const storiesTotal = mine ? storiesData.total : 0;
  const storiesPages = mine ? storiesData.pages : 1;
  // Pagina se corecteaza singura cand stergerea ultimei povesti goleste pagina
  const currentPage = Math.min(storiesPage, storiesPages - 1);
  const [showStoriesSection, setShowStoriesSection] = useState(false);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const storyRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg: { hasEnvOpenAi?: boolean; google?: boolean }) => {
        setAiReady(!!cfg.hasEnvOpenAi);
        setGoogleLogin(!!cfg.google);
      })
      .catch(() => {});

    const checkMobile = () => setIsMobile(window.innerWidth < 520);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Cota de povești și dacă plățile sunt active, pentru contul curent
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetch("/api/me")
      .then((r) => r.json())
      .then((d: { usage?: Usage; billing?: boolean }) => {
        if (cancelled) return;
        setUsage(d.usage ?? null);
        setBilling(!!d.billing);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId, reloadKey]);

  // Istoricul poveștilor, de pe server
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetch(`/api/stories?page=${currentPage}`)
      .then((r) => r.json())
      .then((d: { stories?: SavedStory[]; total?: number; pages?: number }) => {
        if (cancelled || !d.stories) return;
        setStoriesData({ userId, stories: d.stories, total: d.total ?? 0, pages: d.pages ?? 1 });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId, currentPage, reloadKey]);

  // Pre-fetch primul chunk imediat ce apare o poveste nouă
  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;
    fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyId, index: 0 }),
    })
      .then((r) => r.json())
      // Un raspuns fara `audioContent` inseamna acelasi lucru ca un raspuns
      // picat: nu avem audio. Inainte ramanea pe null, adica butonul se invartea
      // la infinit in loc sa cada pe TTS-ul browserului.
      .then((d) => { if (!cancelled) setTtsChunk({ storyId, b64: d.audioContent || "", total: d.total || 1 }); })
      .catch(() => { if (!cancelled) setTtsChunk({ storyId, b64: "", total: 0 }); });
    return () => { cancelled = true; };
  }, [storyId]);

  const loadSavedStory = (s: SavedStory) => {
    stopSpeech();
    setStory(s.text);
    setStoryId(s.id);
    setStoryTitle(s.title || "");
    setStoryCollapsed(false);
    setActiveStoryId(s.id);
    setTimeout(() => storyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const deleteSavedStory = async (id: string) => {
    await fetch(`/api/stories?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    if (id === storyId) { stopSpeech(); setStory(""); setStoryId(null); }
    setReloadKey((k) => k + 1);
  };


const handleNameChange = (index: number, value: string) => {
    const updated = [...names];
    updated[index] = value;
    setNames(updated);
  };

  const addName = () => {
    if (names.length < 6) setNames([...names, ""]);
  };

  const removeName = (index: number) => {
    if (names.length > 1) setNames(names.filter((_, i) => i !== index));
  };

  /*
   * Fara `useCallback`: cu React Compiler activ, memoizarea manuala pe care el nu
   * o poate pastra face sa fie sarita optimizarea INTREGII componente (eroare
   * `preserve-manual-memoization`). Niciuna dintre functiile astea nu apare in
   * vreo lista de dependinte, deci identitatea lor de la un render la altul nu
   * schimba comportamentul.
   */
  const stopSpeech = () => {
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setSpeechState("idle");
  };

  const generateStory = async () => {
    const filteredNames = names.filter((n) => n.trim() !== "");
    if (filteredNames.length === 0) {
      setError("Te rog introdu cel puțin un nume!");
      return;
    }
    if (!aiReady) {
      setError("Serviciul de povești nu este configurat pe server.");
      return;
    }

    setError("");
    setErrorCode(null);
    setLoading(true);
    setStory("");
    setStoryId(null);
    stopSpeech();

    try {
      const res = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: filteredNames, customPrompt, age: age ? Number(age) : undefined, duration: duration ? Number(duration) : undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorCode(data.code || "UNKNOWN");
        if (data.code === "QUOTA") setReloadKey((k) => k + 1);
        throw new Error(data.error || "Eroare la generare");
      }
      setStory(data.story);
      setStoryId(data.id);
      setStoryTitle(data.title || "");
      setStoryCollapsed(false);
      setActiveStoryId(data.id);
      setStoriesPage(0);
      setReloadKey((k) => k + 1);
      setTimeout(() => storyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "A apărut o eroare.");
    } finally {
      setLoading(false);
    }
  };

  const fallbackBrowserTTS = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setSpeechState("idle");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ro-RO";
    utterance.rate = 1.1;
    utterance.pitch = 1.1;
    utterance.volume = 1;
    utterance.onend = () => setSpeechState("idle");
    utterance.onerror = () => setSpeechState("idle");
    const speak = () => {
      const voices = window.speechSynthesis.getVoices();
      const roVoice = voices.find((v) => v.lang.startsWith("ro"));
      if (roVoice) utterance.voice = roVoice;
      window.speechSynthesis.speak(utterance);
      setSpeechState("speaking");
    };
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) speak();
    else window.speechSynthesis.addEventListener("voiceschanged", speak, { once: true });
  };

  const startSpeech = async () => {
    if (!story || !storyId || firstChunkB64 === null) return;
    stopSpeech();

    // Dacă pre-fetch-ul a eșuat (firstChunkB64 === "") → browser TTS direct
    if (firstChunkB64 === "") { fallbackBrowserTTS(story); return; }

    // Primul play este SINCRON în gestul utilizatorului — iOS/Chrome nu poate bloca
    const audio = new Audio(`data:audio/mp3;base64,${firstChunkB64}`);
    audioRef.current = audio;
    setSpeechState("speaking");
    audio.play().catch(() => { fallbackBrowserTTS(story); return; });

    // Restul chunk-urilor se fetch-uiesc și redau async — sesiunea audio e deja activă.
    // Serverul împarte povestea; noi doar cerem bucățile pe rând, după index.
    const total = ttsChunk.total;
    const id = storyId;
    const fetchB64 = async (index: number): Promise<string> => {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: id, index }),
      });
      const data = await res.json();
      if (!res.ok || !data.audioContent) throw new Error("Eroare TTS");
      return data.audioContent as string;
    };

    let current = audio;
    let nextFetch = total > 1 ? fetchB64(1) : null;

    for (let i = 1; i < total; i++) {
      // Așteaptă să termine chunk-ul curent
      await new Promise<void>((resolve) => {
        if (current.ended || !audioRef.current) { resolve(); return; }
        current.onended = () => resolve();
        current.onerror = () => resolve();
      });
      if (!audioRef.current) break;

      try {
        const b64 = await (nextFetch as Promise<string>);
        if (!audioRef.current) break;
        nextFetch = (i + 1 < total) ? fetchB64(i + 1) : null;

        const next = new Audio(`data:audio/mp3;base64,${b64}`);
        audioRef.current = next;
        next.play().catch(() => {});
        current = next;
      } catch { break; }
    }

    // Marchează idle când ultimul chunk termină
    if (audioRef.current === current) {
      current.addEventListener("ended", () => {
        setSpeechState("idle");
        audioRef.current = null;
      }, { once: true });
    }
  };

  const pauseSpeech = () => {
    if (audioRef.current) audioRef.current.pause();
    else window.speechSynthesis?.pause();
    setSpeechState("paused");
  };

  const resumeSpeech = () => {
    if (audioRef.current) audioRef.current.play().catch(() => {});
    else window.speechSynthesis?.resume();
    setSpeechState("speaking");
  };

  const filteredNames = names.filter((n) => n.trim());

  return (
    <div style={{ minHeight: "100vh", position: "relative", zIndex: 1 }}>
      {/* Header */}
      <header style={{ textAlign: "center", padding: isMobile ? "32px 16px 16px" : "52px 16px 24px" }}>
        <div
          className="float-animation"
          style={{ fontSize: isMobile ? 52 : 72, marginBottom: 10, filter: "drop-shadow(0 0 24px rgba(167,139,250,0.6))" }}
        >
          ✨
        </div>
        <h1
          className="glow-text"
          style={{
            fontSize: isMobile ? "2rem" : "clamp(2.2rem, 5vw, 3.2rem)",
            fontWeight: 900,
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          Povestea lui David
        </h1>
        <p style={{ color: "rgba(167,139,250,0.7)", marginTop: 8, fontSize: isMobile ? "0.85rem" : "0.95rem", letterSpacing: "0.04em" }}>
          Povești magice generate cu AI · în română
        </p>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12,
          padding: "5px 14px", borderRadius: 50,
          background: aiReady ? "rgba(16,185,129,0.12)" : "rgba(100,100,120,0.15)",
          border: `1px solid ${aiReady ? "rgba(16,185,129,0.3)" : "rgba(120,120,140,0.2)"}`,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: aiReady ? "#10b981" : "#6b7280",
            display: "inline-block",
            boxShadow: aiReady ? "0 0 8px #10b981" : "none",
          }} />
          <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", color: aiReady ? "#34d399" : "#9ca3af" }}>
            {aiReady ? "AI ACTIV" : "AI INACTIV"}
          </span>
        </div>
      </header>

      <main
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: isMobile ? "0 10px 48px" : "0 16px 64px",
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? 12 : 20,
        }}
      >


        {/* Cont */}
        {!sessionPending && !session && <AuthCard google={googleLogin} />}

        {session && (<>
        <AccountBar email={session.user.email} usage={usage} billing={billing} />

        {/* Names card */}
        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>👦👧 Numele copiilor</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {names.map((name, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: "1.3rem", width: 32, textAlign: "center" }}>
                  {i % 2 === 0 ? "🌟" : "✨"}
                </span>
                <input
                  type="text"
                  value={name}
                  maxLength={40}
                  onChange={(e) => handleNameChange(i, e.target.value)}
                  placeholder={`Numele ${i + 1}…`}
                  style={{ ...inputStyle, flex: 1 }}
                />
                {names.length > 1 && (
                  <button
                    onClick={() => removeName(i)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "rgba(220,38,38,0.6)",
                      color: "white",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      flexShrink: 0,
                    }}
                    type="button"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {names.length < 6 && (
            <button
              onClick={addName}
              style={{
                marginTop: 10,
                padding: "6px 16px",
                borderRadius: 12,
                border: "1.5px dashed rgba(167,139,250,0.4)",
                background: "transparent",
                color: "#a78bfa",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
              type="button"
            >
              + Adaugă un copil
            </button>
          )}
        </div>

        {/* Varsta */}
        <div style={cardStyle}>
          <label htmlFor="child-age" style={{ ...cardTitleStyle, display: "block", marginBottom: 4 }}>
            🎂 Vârsta copilului{" "}
            <span style={{ fontWeight: 400, fontSize: "0.85rem" }}>(opțional)</span>
          </label>
          <p style={{ color: "rgba(167,139,250,0.6)", fontSize: "0.78rem", marginBottom: 8 }}>
            Lungimea și complexitatea poveștii se potrivesc vârstei.
          </p>
          <select
            id="child-age"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
          >
            <option value="">Nespecificată (potrivită pentru 4–6 ani)</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((y) => (
              <option key={y} value={y}>
                {y === 1 ? "1 an" : `${y} ani`}
              </option>
            ))}
          </select>
        </div>

        {/* Durata */}
        <div style={cardStyle}>
          <label htmlFor="story-duration" style={{ ...cardTitleStyle, display: "block", marginBottom: 4 }}>
            ⏱️ Durata poveștii{" "}
            <span style={{ fontWeight: 400, fontSize: "0.85rem" }}>(opțional)</span>
          </label>
          <select
            id="story-duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
          >
            <option value="">Potrivită vârstei</option>
            {[3, 5, 7, 10].map((m) => (
              <option key={m} value={m}>
                ~{m} minute
              </option>
            ))}
          </select>
        </div>

        {/* Custom prompt */}
        <div style={cardStyle}>
          <h2 style={{ ...cardTitleStyle, marginBottom: 4 }}>
            💭 Detalii suplimentare{" "}
            <span style={{ fontWeight: 400, fontSize: "0.85rem" }}>(opțional)</span>
          </h2>
          <p style={{ color: "rgba(167,139,250,0.6)", fontSize: "0.78rem", marginBottom: 8 }}>
            Ex: &quot;David iubește dinozaurii&quot;, &quot;Maria are un cățel
            alb&quot;, &quot;aventură în pădure magică&quot;
          </p>
          <textarea
            value={customPrompt}
            maxLength={500}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Adaugă detalii despre copii sau temă…"
            rows={3}
            style={{
              ...inputStyle,
              width: "100%",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Generate button */}
        <button
          onClick={generateStory}
          disabled={loading}
          style={{
            width: "100%",
            padding: isMobile ? "15px 12px" : "17px",
            minHeight: 54,
            borderRadius: 50,
            border: "none",
            background: loading
              ? "rgba(124,58,237,0.3)"
              : "linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #6d28d9 100%)",
            color: "white",
            fontSize: isMobile ? "1rem" : "1.1rem",
            fontWeight: 800,
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: loading ? "none" : "0 6px 30px rgba(124,58,237,0.5), 0 2px 8px rgba(0,0,0,0.3)",
            transition: "all 0.2s",
            letterSpacing: "0.02em",
          }}
          type="button"
        >
          {loading
            ? "⏳ Se creează povestea…"
            : `✨ Creează povestea cu ${filteredNames.join(" și ") || "personajele"}`}
        </button>

        {/* Error */}
        {error && (
          <div
            style={{
              borderRadius: 16,
              padding: "16px 20px",
              fontSize: "0.9rem",
              ...(errorCode === "QUOTA"
                ? { background: "#fff8e1", color: "#7c5c00", border: "1.5px solid #f0c040" }
                : errorCode === "RATE_LIMIT"
                ? { background: "#e8f5e9", color: "#2e5900", border: "1.5px solid #81c784" }
                : { background: "#ffe4e1", color: "#c0392b", border: "1px solid #e74c3c" }),
            }}
            role="alert"
          >
            {errorCode === "QUOTA" && (
              <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 4 }}>📖 Ai folosit toate poveștile</div>
            )}
            {errorCode === "RATE_LIMIT" && (
              <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 4 }}>⏳ Prea multe cereri</div>
            )}
            <div>{errorCode === "QUOTA" || errorCode === "RATE_LIMIT" ? error : <>⚠️ {error}</>}</div>
          </div>
        )}

        {/* Story output */}
        {story && (
          <div
            ref={storyRef}
            style={{
              background: "rgba(124,58,237,0.07)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(167,139,250,0.35)",
              borderRadius: 20,
              boxShadow: "0 8px 40px rgba(124,58,237,0.2), inset 0 1px 0 rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}
          >
            {/* Header colapsibil */}
            <div
              onClick={() => setStoryCollapsed((c) => !c)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: isMobile ? "12px 16px" : "14px 24px",
                cursor: "pointer",
                userSelect: "none",
                borderBottom: storyCollapsed ? "none" : "1px solid rgba(167,139,250,0.2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: "1.1rem" }}>✨</span>
                <span style={{
                  fontWeight: 700,
                  fontSize: isMobile ? "0.92rem" : "1rem",
                  color: "#e0d0ff",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {storyTitle || "Poveste generată"}
                </span>
              </div>
              <span style={{
                fontSize: "1rem",
                color: "#a78bfa",
                flexShrink: 0,
                marginLeft: 8,
                transition: "transform 0.2s",
                transform: storyCollapsed ? "rotate(0deg)" : "rotate(180deg)",
              }}>
                ▾
              </span>
            </div>

            {/* Conținut expandat */}
            {!storyCollapsed && (
              <div style={{ padding: isMobile ? 16 : 32 }}>

            {/* TTS controls */}
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 20,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {speechState === "idle" && ttsLoading && (
                <button style={{ ...ttsBtnStyle("rgba(16,185,129,0.3)"), opacity: 0.7, cursor: "not-allowed" }} disabled type="button">
                  ⏳ Se pregătește vocea…
                </button>
              )}
              {speechState === "idle" && !ttsLoading && (
                <button
                  onClick={startSpeech}
                  style={ttsBtnStyle("linear-gradient(135deg,#059669,#10b981)")}
                  type="button"
                >
                  🎙️ Ascultă (Alina Neural)
                </button>
              )}
              {speechState === "speaking" && (
                <button onClick={pauseSpeech} style={ttsBtnStyle("linear-gradient(135deg,#d97706,#f59e0b)")} type="button">
                  ⏸️ Pauză
                </button>
              )}
              {speechState === "paused" && (
                <button onClick={resumeSpeech} style={ttsBtnStyle("linear-gradient(135deg,#059669,#10b981)")} type="button">
                  ▶️ Continuă
                </button>
              )}
              {speechState !== "idle" && (
                <button onClick={stopSpeech} style={ttsBtnStyle("linear-gradient(135deg,#dc2626,#ef4444)")} type="button">
                  ⏹️ Stop
                </button>
              )}
              <button
                onClick={generateStory}
                disabled={loading}
                style={{
                  ...ttsBtnStyle("rgba(167,139,250,0.15)"),
                  border: "1px solid rgba(167,139,250,0.35)",
                  color: "#c4b5fd",
                  boxShadow: "none",
                }}
                type="button"
              >
                🔄 Altă poveste
              </button>
            </div>

            {/* Sound wave indicator */}
            {speechState === "speaking" && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 4,
                  marginBottom: 16,
                }}
              >
                {[8, 14, 20, 14, 8, 14, 20, 14, 8].map((h, i) => (
                  <div
                    key={i}
                    style={{
                      width: 4,
                      height: h,
                      background: "#a78bfa",
                      borderRadius: 2,
                      animation: `float ${0.4 + i * 0.08}s ease-in-out infinite alternate`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Story text */}
            <div
              style={{
                lineHeight: 1.85,
                fontSize: isMobile ? "1rem" : "1.1rem",
                color: "#ede9fe",
                whiteSpace: "pre-wrap",
                fontFamily: "Georgia, serif",
              }}
            >
              {story}
            </div>

            <div style={{ textAlign: "center", marginTop: 24, fontSize: "1.5rem" }}>
              🌙 ✨ 🌟
            </div>
              </div>
            )}
          </div>
        )}

        {/* Povești Salvate */}
        {storiesTotal > 0 && (
          <div style={cardStyle}>
            <button
              type="button"
              onClick={() => setShowStoriesSection((v) => !v)}
              style={{ background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left", padding: 0 }}
            >
              <h2 style={{ ...cardTitleStyle, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>📚 Povești salvate <span style={{ fontWeight: 400, fontSize: "0.85rem", color: "rgba(167,139,250,0.6)" }}>({storiesTotal})</span></span>
                <span style={{ fontSize: "0.8rem", color: "#a78bfa" }}>{showStoriesSection ? "▲ Ascunde" : "▼ Arată"}</span>
              </h2>
            </button>

            {showStoriesSection && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                    {savedStories.map((s) => {
                      const isActive = s.id === activeStoryId;
                      const date = new Date(s.createdAt).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
                      const hour = new Date(s.createdAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
                      return (
                        <div
                          key={s.id}
                          style={{
                            border: isActive ? "1px solid rgba(167,139,250,0.6)" : "1px solid rgba(167,139,250,0.15)",
                            borderRadius: 14,
                            padding: "12px 14px",
                            background: isActive ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.03)",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "#e0d0ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {s.title || s.names.join(", ")}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "rgba(167,139,250,0.65)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>
                              {s.names.join(", ")}
                            </div>
                            <div style={{ marginTop: 2 }}>
                              <span style={{ fontSize: "0.68rem", color: "rgba(167,139,250,0.45)" }}>{date} · {hour}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => loadSavedStory(s)}
                            title="Încarcă și ascultă"
                            style={{
                              background: isActive ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "rgba(124,58,237,0.25)",
                              color: isActive ? "white" : "#c4b5fd",
                              border: `1px solid ${isActive ? "transparent" : "rgba(167,139,250,0.3)"}`,
                              borderRadius: 10,
                              padding: "7px 12px",
                              cursor: "pointer",
                              fontWeight: 700,
                              fontSize: "0.8rem",
                              flexShrink: 0,
                            }}
                          >
                            {isActive ? "✅ Activă" : "▶ Ascultă"}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSavedStory(s.id)}
                            title="Șterge"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(167,139,250,0.35)", fontSize: "1rem", flexShrink: 0, padding: "4px" }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                </div>

                {/* Paginare */}
                {storiesPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 14 }}>
                    <button
                      type="button"
                      disabled={currentPage === 0}
                      onClick={() => setStoriesPage(currentPage - 1)}
                      style={{ ...smallBtnStyle, opacity: currentPage === 0 ? 0.4 : 1 }}
                    >
                      ← Anterior
                    </button>
                    <span style={{ color: "#a78bfa", fontSize: "0.85rem" }}>
                      Pagina {currentPage + 1} din {storiesPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= storiesPages - 1}
                      onClick={() => setStoriesPage(currentPage + 1)}
                      style={{ ...smallBtnStyle, opacity: currentPage >= storiesPages - 1 ? 0.4 : 1 }}
                    >
                      Următor →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        </>)}
      </main>

      <footer
        style={{
          textAlign: "center",
          padding: "16px",
          color: "rgba(167,139,250,0.4)",
          fontSize: "0.8rem",
          letterSpacing: "0.04em",
        }}
      >
        Cu dragoste pentru David ✨ · Povești magice în română
      </footer>
    </div>
  );
}
