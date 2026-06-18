"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const STORIES_KEY = "david_stories";
const PAGE_SIZE = 20;
const MAX_STORIES = 200;

interface SavedStory {
  id: string;
  title: string;
  text: string;
  names: string[];
  createdAt: string;
  customPrompt?: string;
}

function getLocalStories(): SavedStory[] {
  try { return JSON.parse(localStorage.getItem(STORIES_KEY) || "[]"); }
  catch { return []; }
}
function addLocalStory(s: SavedStory) {
  const updated = [s, ...getLocalStories()].slice(0, MAX_STORIES);
  localStorage.setItem(STORIES_KEY, JSON.stringify(updated));
}
function removeLocalStory(id: string) {
  localStorage.setItem(STORIES_KEY, JSON.stringify(getLocalStories().filter((s) => s.id !== id)));
}

type SpeechState = "idle" | "speaking" | "paused";

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [names, setNames] = useState<string[]>(["", ""]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [story, setStory] = useState("");
  const [storyTitle, setStoryTitle] = useState("");
  const [storyCollapsed, setStoryCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [speechState, setSpeechState] = useState<SpeechState>("idle");
  const [ttsLoading, setTtsLoading] = useState(false);
  const [firstChunkB64, setFirstChunkB64] = useState<string | null>(null);
  const [envKeys, setEnvKeys] = useState({ openai: false, elevenlabs: false });
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [savedStories, setSavedStories] = useState<SavedStory[]>([]);
  const [storiesPage, setStoriesPage] = useState(0);
  const [storiesTotal, setStoriesTotal] = useState(0);
  const [storiesPages, setStoriesPages] = useState(0);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [showStoriesSection, setShowStoriesSection] = useState(false);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const storyRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg: { openAiKey?: string; hasEnvOpenAi?: boolean }) => {
        if (cfg.openAiKey) setApiKey(cfg.openAiKey);
        setEnvKeys({ openai: !!cfg.hasEnvOpenAi, elevenlabs: false });
      })
      .catch(() => {});

    loadStories(0);

    const checkMobile = () => setIsMobile(window.innerWidth < 520);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Pre-fetch primul chunk imediat ce apare o poveste nouă
  useEffect(() => {
    if (!story) { setFirstChunkB64(null); return; }
    setFirstChunkB64(null);
    setTtsLoading(true);
    const sentences = story.match(/[^.!?\n]+[.!?\n]+/g) ?? [story];
    const firstText = sentences.slice(0, 4).join("").trim() || story;
    let cancelled = false;
    fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: firstText }),
    })
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.audioContent) setFirstChunkB64(d.audioContent); })
      .catch(() => { if (!cancelled) setFirstChunkB64(""); }) // "" = fallback browser TTS
      .finally(() => { if (!cancelled) setTtsLoading(false); });
    return () => { cancelled = true; };
  }, [story]);

  const loadStories = (page: number) => {
    const all = getLocalStories();
    setSavedStories(all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE));
    setStoriesTotal(all.length);
    setStoriesPages(Math.ceil(all.length / PAGE_SIZE) || 1);
    setStoriesPage(page);
  };

  const saveStoryToHistory = (text: string, title: string) => {
    const filteredNames = names.filter((n) => n.trim());
    const entry: SavedStory = {
      id: crypto.randomUUID(),
      title,
      text,
      names: filteredNames,
      createdAt: new Date().toISOString(),
      customPrompt: customPrompt || undefined,
    };
    addLocalStory(entry);
    loadStories(0);
  };

  const loadSavedStory = (s: SavedStory) => {
    stopSpeech();
    setStory(s.text);
    setStoryTitle(s.title || "");
    setStoryCollapsed(false);
    setActiveStoryId(s.id);
    setTimeout(() => storyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const deleteSavedStory = (id: string) => {
    removeLocalStory(id);
    loadStories(storiesPage);
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

  const stopSpeech = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setSpeechState("idle");
  }, []);

  const generateStory = async () => {
    const filteredNames = names.filter((n) => n.trim() !== "");
    if (filteredNames.length === 0) {
      setError("Te rog introdu cel puțin un nume!");
      return;
    }
    if (!apiKey.trim() && !envKeys.openai) {
      setError("Cheia API OpenAI nu este configurată. Adaugă-o în variabilele de mediu ale serverului.");
      return;
    }

    setError("");
    setErrorCode(null);
    setLoading(true);
    setStory("");
    stopSpeech();

    try {
      const res = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: filteredNames, customPrompt, apiKey }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorCode(data.code || "UNKNOWN");
        throw new Error(data.error || "Eroare la generare");
      }
      setStory(data.story);
      setStoryTitle(data.title || "");
      setStoryCollapsed(false);
      setActiveStoryId(null);
      saveStoryToHistory(data.story, data.title || "");
      setTimeout(() => storyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "A apărut o eroare.");
    } finally {
      setLoading(false);
    }
  };

  const fallbackBrowserTTS = useCallback((text: string) => {
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
  }, []);

  const startSpeech = useCallback(async () => {
    if (!story || firstChunkB64 === null) return;
    stopSpeech();

    // Dacă pre-fetch-ul a eșuat (firstChunkB64 === "") → browser TTS direct
    if (firstChunkB64 === "") { fallbackBrowserTTS(story); return; }

    // Primul play este SINCRON în gestul utilizatorului — iOS/Chrome nu poate bloca
    const audio = new Audio(`data:audio/mp3;base64,${firstChunkB64}`);
    audioRef.current = audio;
    setSpeechState("speaking");
    audio.play().catch(() => { fallbackBrowserTTS(story); return; });

    // Restul chunk-urilor se fetch-uiesc și redau async — sesiunea audio e deja activă
    const sentences = story.match(/[^.!?\n]+[.!?\n]+/g) ?? [story];
    const CHUNK_SIZE = 4;
    const textChunks: string[] = [];
    for (let i = 0; i < sentences.length; i += CHUNK_SIZE) {
      const c = sentences.slice(i, i + CHUNK_SIZE).join("").trim();
      if (c) textChunks.push(c);
    }

    const fetchB64 = async (text: string): Promise<string> => {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok || !data.audioContent) throw new Error("Eroare TTS");
      return data.audioContent as string;
    };

    let current = audio;
    let nextFetch = textChunks.length > 1 ? fetchB64(textChunks[1]) : null;

    for (let i = 1; i < textChunks.length; i++) {
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
        nextFetch = (i + 1 < textChunks.length) ? fetchB64(textChunks[i + 1]) : null;

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
  }, [story, firstChunkB64, stopSpeech, fallbackBrowserTTS]);

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
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #fff9f0 0%, #fef3e2 50%, #fff0e6 100%)",
      }}
    >
      {/* Header */}
      <header style={{ textAlign: "center", padding: isMobile ? "24px 16px 12px" : "40px 16px 20px" }}>
        <div style={{ fontSize: isMobile ? 48 : 64, marginBottom: 8 }}>📖</div>
        <h1
          style={{
            fontSize: isMobile ? "1.8rem" : "clamp(2rem, 5vw, 3rem)",
            fontWeight: 800,
            color: "#8B4513",
            fontFamily: "Georgia, serif",
            margin: 0,
          }}
        >
          Povestea lui David
        </h1>
        <p style={{ color: "#A0522D", marginTop: 6, fontSize: isMobile ? "0.9rem" : "1.05rem" }}>
          Povești personalizate în română · ~5 min
        </p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, padding: "4px 12px", borderRadius: 20, background: (envKeys.openai || apiKey.trim()) ? "rgba(76,175,80,0.12)" : "rgba(180,180,180,0.15)" }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: (envKeys.openai || apiKey.trim()) ? "#4caf50" : "#bdbdbd",
            display: "inline-block",
            boxShadow: (envKeys.openai || apiKey.trim()) ? "0 0 0 3px rgba(76,175,80,0.25)" : "none",
          }} />
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: (envKeys.openai || apiKey.trim()) ? "#2e7d32" : "#9e9e9e" }}>
            {(envKeys.openai || apiKey.trim()) ? "AI activ" : "AI inactiv"}
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
                      background: "#e07b54",
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
                border: "2px dashed #d2a679",
                background: "transparent",
                color: "#A0522D",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
              type="button"
            >
              + Adaugă un copil
            </button>
          )}
        </div>

        {/* Custom prompt */}
        <div style={cardStyle}>
          <h2 style={{ ...cardTitleStyle, marginBottom: 4 }}>
            💭 Detalii suplimentare{" "}
            <span style={{ fontWeight: 400, fontSize: "0.85rem" }}>(opțional)</span>
          </h2>
          <p style={{ color: "#b87333", fontSize: "0.78rem", marginBottom: 8 }}>
            Ex: &quot;David iubește dinozaurii&quot;, &quot;Maria are un cățel
            alb&quot;, &quot;aventură în pădure magică&quot;
          </p>
          <textarea
            value={customPrompt}
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
            padding: isMobile ? "14px 12px" : "16px",
            minHeight: 52,
            borderRadius: 24,
            border: "none",
            background: loading
              ? "#d2a679"
              : "linear-gradient(135deg, #f5a623, #e07b54)",
            color: "white",
            fontSize: isMobile ? "1rem" : "1.15rem",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: loading ? "none" : "0 6px 24px rgba(224,123,84,0.45)",
            transition: "all 0.2s",
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
              ...(errorCode === "NO_CREDITS"
                ? { background: "#fff8e1", color: "#7c5c00", border: "1.5px solid #f0c040" }
                : errorCode === "INVALID_KEY"
                ? { background: "#fce4ec", color: "#880e4f", border: "1.5px solid #e57373" }
                : errorCode === "RATE_LIMIT"
                ? { background: "#e8f5e9", color: "#2e5900", border: "1.5px solid #81c784" }
                : { background: "#ffe4e1", color: "#c0392b", border: "1px solid #e74c3c" }),
            }}
          >
            {errorCode === "NO_CREDITS" && (
              <>
                <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 4 }}>💸 Credite OpenAI epuizate</div>
                <div>Contul tău OpenAI nu mai are credite. Reîncarcă-l din <a href="https://platform.openai.com/settings/organization/billing" target="_blank" rel="noopener noreferrer" style={{ color: "#7c5c00", fontWeight: 600 }}>dashboard-ul OpenAI</a> sau folosește generarea <strong>Locală</strong> (gratuită).</div>
              </>
            )}
            {errorCode === "INVALID_KEY" && (
              <>
                <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 4 }}>🔑 Cheie API invalidă</div>
                <div>Cheia introdusă nu este corectă. Verifică-o în <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: "#880e4f", fontWeight: 600 }}>dashboard-ul OpenAI</a>.</div>
              </>
            )}
            {errorCode === "RATE_LIMIT" && (
              <>
                <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 4 }}>⏳ Prea multe cereri</div>
                <div>Ai atins limita de cereri pe minut. Așteaptă câteva secunde și încearcă din nou.</div>
              </>
            )}
            {(!errorCode || errorCode === "UNKNOWN") && <>⚠️ {error}</>}
          </div>
        )}

        {/* Story output */}
        {story && (
          <div
            ref={storyRef}
            style={{
              background: "rgba(255,255,255,0.97)",
              border: "2px solid #f5deb3",
              borderRadius: 20,
              boxShadow: "0 8px 32px rgba(139,69,19,0.08)",
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
                padding: isMobile ? "12px 16px" : "14px 28px",
                cursor: "pointer",
                userSelect: "none",
                background: storyCollapsed ? "#fff9f0" : "transparent",
                borderBottom: storyCollapsed ? "none" : "1px solid #f5deb3",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: "1.1rem" }}>📖</span>
                <span style={{
                  fontWeight: 700,
                  fontSize: isMobile ? "0.92rem" : "1rem",
                  color: "#5c3010",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {storyTitle || "Poveste generată"}
                </span>
              </div>
              <span style={{
                fontSize: "1.1rem",
                color: "#b87333",
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
                <button style={{ ...ttsBtnStyle("#27ae60"), opacity: 0.6, cursor: "not-allowed" }} disabled type="button">
                  ⏳ Se pregătește vocea…
                </button>
              )}
              {speechState === "idle" && !ttsLoading && (
                <button
                  onClick={startSpeech}
                  style={ttsBtnStyle("#27ae60")}
                  type="button"
                >
                  🎙️ Ascultă (Alina Neural)
                </button>
              )}
              {speechState === "speaking" && (
                <button
                  onClick={pauseSpeech}
                  style={ttsBtnStyle("#f39c12")}
                  type="button"
                >
                  ⏸️ Pauză
                </button>
              )}
              {speechState === "paused" && (
                <button
                  onClick={resumeSpeech}
                  style={ttsBtnStyle("#27ae60")}
                  type="button"
                >
                  ▶️ Continuă
                </button>
              )}
              {speechState !== "idle" && (
                <button
                  onClick={stopSpeech}
                  style={ttsBtnStyle("#e74c3c")}
                  type="button"
                >
                  ⏹️ Stop
                </button>
              )}
              <button
                onClick={generateStory}
                disabled={loading}
                style={{
                  ...ttsBtnStyle("#8B4513"),
                  background: "#f5deb3",
                  color: "#8B4513",
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
                      background: "#f5a623",
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
                color: "#2d1b00",
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
                <span>📚 Povești salvate <span style={{ fontWeight: 400, fontSize: "0.85rem", color: "#b87333" }}>({storiesTotal})</span></span>
                <span style={{ fontSize: "0.8rem", color: "#b87333" }}>{showStoriesSection ? "▲ Ascunde" : "▼ Arată"}</span>
              </h2>
            </button>

            {showStoriesSection && (
              <>
                {storiesLoading ? (
                  <div style={{ textAlign: "center", color: "#b87333", padding: 16 }}>Se încarcă…</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                    {savedStories.map((s) => {
                      const isActive = s.id === activeStoryId;
                      const date = new Date(s.createdAt).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
                      const hour = new Date(s.createdAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
                      return (
                        <div
                          key={s.id}
                          style={{
                            border: isActive ? "2px solid #f5a623" : "1.5px solid #f5deb3",
                            borderRadius: 14,
                            padding: "12px 14px",
                            background: isActive ? "#fffbf0" : "#fffdf8",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#5c3010", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {s.title || s.names.join(", ")}
                            </div>
                            <div style={{ fontSize: "0.78rem", color: "#b87333", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>
                              {s.names.join(", ")}
                            </div>
                            <div style={{ marginTop: 3 }}>
                              <span style={{ fontSize: "0.72rem", color: "#a07040" }}>{date} · {hour}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => loadSavedStory(s)}
                            title="Încarcă și ascultă"
                            style={{
                              background: isActive ? "#f5a623" : "linear-gradient(135deg, #f5a623, #e07b54)",
                              color: "white",
                              border: "none",
                              borderRadius: 10,
                              padding: "7px 12px",
                              cursor: "pointer",
                              fontWeight: 700,
                              fontSize: "0.82rem",
                              flexShrink: 0,
                            }}
                          >
                            {isActive ? "✅ Activă" : "▶ Ascultă"}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSavedStory(s.id)}
                            title="Șterge"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: "1rem", flexShrink: 0, padding: "4px" }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Paginare */}
                {storiesPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 14 }}>
                    <button
                      type="button"
                      disabled={storiesPage === 0}
                      onClick={() => loadStories(storiesPage - 1)}
                      style={{ ...smallBtnStyle, opacity: storiesPage === 0 ? 0.4 : 1 }}
                    >
                      ← Anterior
                    </button>
                    <span style={{ color: "#8B4513", fontSize: "0.85rem" }}>
                      Pagina {storiesPage + 1} din {storiesPages}
                    </span>
                    <button
                      type="button"
                      disabled={storiesPage >= storiesPages - 1}
                      onClick={() => loadStories(storiesPage + 1)}
                      style={{ ...smallBtnStyle, opacity: storiesPage >= storiesPages - 1 ? 0.4 : 1 }}
                    >
                      Următor →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </main>

      <footer
        style={{
          textAlign: "center",
          padding: "16px",
          color: "#b87333",
          fontSize: "0.85rem",
        }}
      >
        Cu dragoste pentru copiii voștri 💛 · Povești în română · ~5 minute
      </footer>
    </div>
  );
}

// ── Shared micro-styles ──────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.85)",
  border: "2px solid #f5deb3",
  borderRadius: 20,
  padding: "16px",
  boxShadow: "0 2px 12px rgba(139,69,19,0.06)",
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 700,
  color: "#8B4513",
  marginTop: 0,
  marginBottom: 12,
};

const inputStyle: React.CSSProperties = {
  border: "1.5px solid #d2a679",
  borderRadius: 12,
  padding: "8px 14px",
  fontSize: "0.95rem",
  background: "#fffdf8",
  outline: "none",
  color: "#2d1b00",
  fontFamily: "inherit",
};

const smallBtnStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 12,
  border: "1.5px solid #d2a679",
  background: "#f5deb3",
  color: "#8B4513",
  cursor: "pointer",
  fontSize: "1rem",
};

const ttsBtnStyle = (bg: string): React.CSSProperties => ({
  padding: "10px 16px",
  borderRadius: 20,
  border: "none",
  background: bg,
  color: "white",
  cursor: "pointer",
  fontSize: "0.88rem",
  fontWeight: 600,
  minHeight: 44,
});
