"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { generateLocalStory, createTemplateFromStory } from "./lib/localStoryGenerator";

const STORY_TYPES = [
  { value: "original", label: "Poveste originală", emoji: "✨" },
  { value: "cei-3-purcelusi", label: "Cei Trei Purceluși", emoji: "🐷" },
  { value: "alba-ca-zapada", label: "Alba ca Zăpada", emoji: "🍎" },
  { value: "scufita-rosie", label: "Scufița Roșie", emoji: "🧣" },
  { value: "cenusareasa", label: "Cenușăreasa", emoji: "👠" },
  { value: "frumoasa-adormita", label: "Frumoasa Adormită", emoji: "👸" },
  { value: "hansel-si-gretel", label: "Hansel și Gretel", emoji: "🏠" },
  { value: "motanul-incaltat", label: "Motanul Încălțat", emoji: "🐈" },
];

type SpeechState = "idle" | "speaking" | "paused";
type GenerationMode = "local" | "openai";

export default function Home() {
  const [mode, setMode] = useState<GenerationMode>("local");
  const [apiKey, setApiKey] = useState("");
  const [showApiSection, setShowApiSection] = useState(false);
  const [names, setNames] = useState<string[]>(["", ""]);
  const [storyType, setStoryType] = useState("original");
  const [customPrompt, setCustomPrompt] = useState("");
  const [story, setStory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [speechState, setSpeechState] = useState<SpeechState>("idle");
  const [showApiKey, setShowApiKey] = useState(false);
  const [openAiKeySaved, setOpenAiKeySaved] = useState(false);
  const [elevenLabsKey, setElevenLabsKey] = useState("");
  const [showElevenLabsSection, setShowElevenLabsSection] = useState(false);
  const [showElevenLabsKey, setShowElevenLabsKey] = useState(false);
  const [elevenLabsKeySaved, setElevenLabsKeySaved] = useState(false);
  const [aiEnhancedTypes, setAiEnhancedTypes] = useState<Set<string>>(new Set());
  const [usedAiTemplate, setUsedAiTemplate] = useState(false);
  const [aiTemplates, setAiTemplates] = useState<Record<string, string>>({});
  const [ttsLoading, setTtsLoading] = useState(false);
  const [envKeys, setEnvKeys] = useState({ openai: false, elevenlabs: false });
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const storyRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Încarcă configurația salvată (chei API) și template-urile AI la startup
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg: { elevenLabsKey?: string; openAiKey?: string; hasEnvOpenAi?: boolean; hasEnvElevenLabs?: boolean }) => {
        if (cfg.elevenLabsKey) setElevenLabsKey(cfg.elevenLabsKey);
        if (cfg.openAiKey) setApiKey(cfg.openAiKey);
        setEnvKeys({ openai: !!cfg.hasEnvOpenAi, elevenlabs: !!cfg.hasEnvElevenLabs });
      })
      .catch(() => {});

    fetch("/api/templates")
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        setAiTemplates(data);
        setAiEnhancedTypes(new Set(Object.keys(data)));
      })
      .catch(() => {});
  }, []);

  const saveOpenAiKey = async () => {
    try {
      await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openAiKey: apiKey.trim() }),
      });
      setOpenAiKeySaved(true);
      setTimeout(() => setOpenAiKeySaved(false), 2500);
    } catch {
      // silently ignore
    }
  };

  const saveElevenLabsKey = async () => {
    try {
      await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elevenLabsKey: elevenLabsKey.trim() }),
      });
      setElevenLabsKeySaved(true);
      setTimeout(() => setElevenLabsKeySaved(false), 2500);
    } catch {
      // silently ignore
    }
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
    // Oprește audio HTML5 (ElevenLabs TTS)
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    // Oprește Web Speech API (fallback)
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }
    setSpeechState("idle");
  }, []);

  const generateStory = async () => {
    const filteredNames = names.filter((n) => n.trim() !== "");
    if (filteredNames.length === 0) {
      setError("Te rog introdu cel puțin un nume!");
      return;
    }
    if (mode === "openai" && !apiKey.trim() && !envKeys.openai) {
      setError("Te rog introdu cheia ta API OpenAI sau folosește generarea locală!");
      return;
    }

    setError("");
    setErrorCode(null);
    setLoading(true);
    setStory("");
    stopSpeech();

    try {
      if (mode === "local") {
        // Generate story directly in the browser – no API needed
        const wasEnhanced = !!aiTemplates[storyType];
        const generated = generateLocalStory(filteredNames, storyType, customPrompt, aiTemplates);
        setStory(generated);
        setUsedAiTemplate(wasEnhanced);
      } else {
        const res = await fetch("/api/generate-story", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            names: filteredNames,
            storyType,
            customPrompt,
            apiKey,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setErrorCode(data.code || "UNKNOWN");
          throw new Error(data.error || "Eroare la generare");
        }
        setStory(data.story);
        setUsedAiTemplate(false);
        // Salvează template-ul AI server-side (disponibil pentru toți utilizatorii)
        const template = createTemplateFromStory(data.story, filteredNames);
        fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storyType, template }),
        }).then(() => {
          setAiTemplates((prev) => ({ ...prev, [storyType]: template }));
          setAiEnhancedTypes((prev) => new Set([...prev, storyType]));
        }).catch(() => {/* ignorat - template-ul nu s-a salvat, se va încerca data viitoare */});
      }
      setTimeout(() => {
        storyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "A apărut o eroare.");
    } finally {
      setLoading(false);
    }
  };

  const startSpeech = useCallback(async () => {
    if (!story) return;
    stopSpeech();

    if (elevenLabsKey.trim()) {
      // ── ElevenLabs TTS – voce neurală multilinguală ──
      // Audio creat SINCRON în gestul utilizatorului → browserul acordă permisiunea autoplay
      const audio = new Audio();
      audioRef.current = audio;
      setTtsLoading(true);
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: story, apiKey: elevenLabsKey }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Eroare ElevenLabs TTS");

        audio.onended = () => setSpeechState("idle");
        audio.onerror = () => setSpeechState("idle");
        audio.src = `data:audio/mp3;base64,${data.audioContent}`;
        await audio.play();
        setSpeechState("speaking"); // setat DUPĂ ce play() pornește cu succes
      } catch (err) {
        audioRef.current = null;
        setSpeechState("idle");
        setError(err instanceof Error ? err.message : "Eroare la redarea vocii.");
      } finally {
        setTtsLoading(false);
      }
    } else {
      // ── Fallback: Web Speech API ──
      if (typeof window === "undefined") return;
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(story);
        utterance.lang = "ro-RO";
        utterance.rate = 0.88;
        utterance.pitch = 1.05;
        utterance.volume = 1;

        const voices = window.speechSynthesis.getVoices();
        const FEMININE_RO = ["ioana", "carmen", "roxana", "andreea", "elena", "maria", "female", "woman"];
        const roVoices = voices.filter((v) => v.lang.startsWith("ro"));
        const roFemaleVoice =
          roVoices.find((v) => FEMININE_RO.some((k) => v.name.toLowerCase().includes(k))) ||
          roVoices[0];
        const roVoice = roFemaleVoice || voices.find((v) => v.localService);
        if (roVoice) utterance.voice = roVoice;

        utterance.onend = () => setSpeechState("idle");
        utterance.onerror = () => setSpeechState("idle");
        window.speechSynthesis.speak(utterance);
        setSpeechState("speaking");
      }, 100);
    }
  }, [story, stopSpeech, elevenLabsKey]);

  const pauseSpeech = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    } else {
      window.speechSynthesis.pause();
    }
    setSpeechState("paused");
  };

  const resumeSpeech = () => {
    if (audioRef.current) {
      audioRef.current.play();
    } else {
      window.speechSynthesis.resume();
    }
    setSpeechState("speaking");
  };

  const selectedType = STORY_TYPES.find((t) => t.value === storyType);
  const filteredNames = names.filter((n) => n.trim());

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #fff9f0 0%, #fef3e2 50%, #fff0e6 100%)",
      }}
    >
      {/* Header */}
      <header style={{ textAlign: "center", padding: "40px 16px 20px" }}>
        <div style={{ fontSize: 64, marginBottom: 8 }}>📖</div>
        <h1
          style={{
            fontSize: "clamp(2rem, 5vw, 3rem)",
            fontWeight: 800,
            color: "#8B4513",
            fontFamily: "Georgia, serif",
            margin: 0,
          }}
        >
          Povestea lui David
        </h1>
        <p style={{ color: "#A0522D", marginTop: 8, fontSize: "1.05rem" }}>
          Povești personalizate în limba română · ~5 minute narare
        </p>
      </header>

      <main
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "0 16px 64px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Mode selector card */}
        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>⚙️ Mod generare</h2>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => setMode("local")}
              style={{
                flex: 1,
                padding: "12px 8px",
                borderRadius: 16,
                border: `2px solid ${mode === "local" ? "#e07b54" : "#f5deb3"}`,
                background: mode === "local"
                  ? "linear-gradient(135deg, #f5a623, #e07b54)"
                  : "#fffdf8",
                color: mode === "local" ? "white" : "#8B4513",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "0.9rem",
              }}
            >
              🏠 Local<br />
              <span style={{ fontWeight: 400, fontSize: "0.78rem" }}>
                Instant, fără cont
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setMode("openai"); setShowApiSection(true); }}
              style={{
                flex: 1,
                padding: "12px 8px",
                borderRadius: 16,
                border: mode === "openai"
                  ? "2px solid #e07b54"
                  : envKeys.openai
                    ? "2px solid #66bb6a"
                    : "2px solid #f5deb3",
                background: mode === "openai"
                  ? "linear-gradient(135deg, #f5a623, #e07b54)"
                  : "#fffdf8",
                color: mode === "openai" ? "white" : "#8B4513",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "0.9rem",
                position: "relative",
              }}
            >
              🤖 OpenAI GPT<br />
              <span style={{ fontWeight: 400, fontSize: "0.78rem" }}>
                {envKeys.openai ? "✅ Configurat și activ" : "Creativitate maximă"}
              </span>
              {envKeys.openai && mode !== "openai" && (
                <span style={{
                  position: "absolute",
                  top: 6,
                  right: 8,
                  background: "#66bb6a",
                  color: "white",
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  borderRadius: 6,
                  padding: "1px 5px",
                }}>ACTIV</span>
              )}
            </button>
          </div>
          {mode === "local" && (
            <p style={{ color: "#7a9e3b", fontSize: "0.8rem", marginTop: 8, marginBottom: 0 }}>
              ✅ Povestea se generează direct în browser — nu este nevoie de cont sau cheie API.
            </p>
          )}
        </div>

        {/* OpenAI API Key card – ascuns dacă cheia e configurată prin env var */}
        {mode === "openai" && !envKeys.openai && (
          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>🔑 Cheie API OpenAI</h2>
            {envKeys.openai ? (
              <div style={{ background: "#e8f5e9", border: "1.5px solid #66bb6a", borderRadius: 12, padding: "10px 14px", fontSize: "0.85rem", color: "#2e7d32" }}>
                ✅ Cheie configurată pe server — nu este nevoie să o introduci manual.
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); setOpenAiKeySaved(false); }}
                    placeholder="sk-..."
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    onClick={() => setShowApiKey((v) => !v)}
                    style={{ ...smallBtnStyle, flexShrink: 0 }}
                    type="button"
                  >
                    {showApiKey ? "🙈" : "👁️"}
                  </button>
                  <button
                    onClick={saveOpenAiKey}
                    disabled={!apiKey.trim()}
                    style={{
                      ...smallBtnStyle,
                      flexShrink: 0,
                      background: openAiKeySaved ? "#e8f5e9" : "#f5deb3",
                      color: openAiKeySaved ? "#2e7d32" : "#8B4513",
                      border: openAiKeySaved ? "1.5px solid #66bb6a" : "1.5px solid #d2a679",
                      cursor: apiKey.trim() ? "pointer" : "not-allowed",
                      opacity: apiKey.trim() ? 1 : 0.5,
                      transition: "all 0.3s",
                      whiteSpace: "nowrap",
                    }}
                    type="button"
                  >
                    {openAiKeySaved ? "✅ Salvat!" : "💾 Salvează"}
                  </button>
                </div>
                <p style={{ color: "#b87333", fontSize: "0.78rem", marginTop: 6 }}>
                  Cheia se salvează local în fișierul proiectului — rămâne setată la fiecare reîncărcare.{" "}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: "#8B4513" }}>
                    Obține cheie →
                  </a>
                </p>
              </>
            )}
          </div>
        )}

        {/* ElevenLabs TTS card – ascuns dacă cheia e configurată prin env var */}
        <div style={{ ...cardStyle, display: envKeys.elevenlabs ? "none" : undefined }}>
          <button
            type="button"
            onClick={() => setShowElevenLabsSection((v) => !v)}
            style={{
              width: "100%",
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 0,
            }}
          >
            <h2 style={{ ...cardTitleStyle, marginBottom: 0 }}>
              🎙️ Voce neurală nativă{" "}
              <span style={{ fontWeight: 400, fontSize: "0.8rem", color: "#b87333" }}>(opțional)</span>
            </h2>
            <span style={{ color: "#A0522D", fontSize: "0.85rem" }}>
              {showElevenLabsSection ? "▲ Ascunde" : "▼ Configurează"}
            </span>
          </button>

          {!showElevenLabsSection && (
            <p style={{ color: "#7a9e3b", fontSize: "0.8rem", marginTop: 8, marginBottom: 0 }}>
              {elevenLabsKey.trim()
                ? "✅ Voce ElevenLabs Matilda activată – pronunție naturală în română."
                : "ℹ️ Adaugă o cheie ElevenLabs pentru voce neurală (gratuit, fără card bancar)."}
            </p>
          )}

          {showElevenLabsSection && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ color: "#6b4c2a", fontSize: "0.82rem", margin: 0 }}>
                Folosește modelul <strong>eleven_multilingual_v2</strong> de la ElevenLabs —
                voce feminină călduroasă, pronunție naturală în română.{" "}
                <strong>10.000 caractere/lună gratuit</strong>, fără card bancar.
              </p>
              {envKeys.elevenlabs ? (
                <div style={{ background: "#e8f5e9", border: "1.5px solid #66bb6a", borderRadius: 12, padding: "10px 14px", fontSize: "0.85rem", color: "#2e7d32" }}>
                  ✅ Cheie configurată pe server — vocea Matilda este activă automat.
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type={showElevenLabsKey ? "text" : "password"}
                    value={elevenLabsKey}
                    onChange={(e) => { setElevenLabsKey(e.target.value); setElevenLabsKeySaved(false); }}
                    placeholder="sk_..."
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    onClick={() => setShowElevenLabsKey((v) => !v)}
                    style={{ ...smallBtnStyle, flexShrink: 0 }}
                    type="button"
                  >
                    {showElevenLabsKey ? "🙈" : "👁️"}
                  </button>
                  <button
                    onClick={saveElevenLabsKey}
                    disabled={!elevenLabsKey.trim()}
                    style={{
                      ...smallBtnStyle,
                      flexShrink: 0,
                      background: elevenLabsKeySaved ? "#e8f5e9" : "#f5deb3",
                      color: elevenLabsKeySaved ? "#2e7d32" : "#8B4513",
                      border: elevenLabsKeySaved ? "1.5px solid #66bb6a" : "1.5px solid #d2a679",
                      cursor: elevenLabsKey.trim() ? "pointer" : "not-allowed",
                      opacity: elevenLabsKey.trim() ? 1 : 0.5,
                      transition: "all 0.3s",
                      whiteSpace: "nowrap",
                    }}
                    type="button"
                  >
                    {elevenLabsKeySaved ? "✅ Salvat!" : "💾 Salvează"}
                  </button>
                </div>
              )}
              <p style={{ color: "#b87333", fontSize: "0.78rem", margin: 0 }}>
                Cheia se salvează local în fișierul proiectului — rămâne setată la fiecare reîncărcare.{" "}
                <a
                  href="https://elevenlabs.io/app/sign-up"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#8B4513" }}
                >
                  Creează cont ElevenLabs gratuit →
                </a>
              </p>
            </div>
          )}
        </div>

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

        {/* Story type */}
        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>📚 Tipul poveștii</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            {STORY_TYPES.map((type) => {
              const active = storyType === type.value;
              return (
                <button
                  key={type.value}
                  onClick={() => setStoryType(type.value)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: `2px solid ${active ? "#e07b54" : "#f5deb3"}`,
                    background: active
                      ? "linear-gradient(135deg, #f5a623, #e07b54)"
                      : "#fffdf8",
                    color: active ? "white" : "#8B4513",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    boxShadow: active ? "0 4px 12px rgba(224,123,84,0.35)" : "none",
                  }}
                  type="button"
                >
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                    <span>{type.emoji} {type.label}</span>
                    {aiEnhancedTypes.has(type.value) && (
                      <span style={{
                        fontSize: "0.62rem",
                        background: active ? "rgba(255,255,255,0.3)" : "#f5a623",
                        color: active ? "white" : "white",
                        borderRadius: 6,
                        padding: "1px 5px",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}>✨ AI</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
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
            padding: "16px",
            borderRadius: 24,
            border: "none",
            background: loading
              ? "#d2a679"
              : "linear-gradient(135deg, #f5a623, #e07b54)",
            color: "white",
            fontSize: "1.15rem",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: loading ? "none" : "0 6px 24px rgba(224,123,84,0.45)",
            transition: "all 0.2s",
          }}
          type="button"
        >
          {loading
            ? "⏳ Se creează povestea…"
            : `✨ Creează povestea ${selectedType?.emoji || ""} cu ${
                filteredNames.join(" și ") || "personajele"
              }`}
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
              borderRadius: 24,
              padding: 32,
              boxShadow: "0 8px 32px rgba(139,69,19,0.08)",
            }}
          >
            {/* Indicator îmbunătățit AI */}
            {usedAiTemplate && mode === "local" && (
              <div style={{
                background: "linear-gradient(135deg, #fff8e7, #fef3cc)",
                border: "1.5px solid #f5a623",
                borderRadius: 12,
                padding: "8px 14px",
                fontSize: "0.8rem",
                color: "#7a5c00",
                marginBottom: 16,
                textAlign: "center",
              }}>
                ✨ Poveste generată cu template îmbunătățit de AI
              </div>
            )}

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
              {speechState === "idle" && !ttsLoading && (
                <button
                  onClick={startSpeech}
                  style={ttsBtnStyle("#27ae60")}
                  type="button"
                >
                  {elevenLabsKey.trim() ? "🎙️ Ascultă (Matilda Neural)" : "🎙️ Ascultă povestea"}
                </button>
              )}
              {ttsLoading && (
                <button style={{ ...ttsBtnStyle("#27ae60"), opacity: 0.7, cursor: "not-allowed" }} disabled type="button">
                  ⏳ Se pregătește vocea…
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
                lineHeight: 1.9,
                fontSize: "1.1rem",
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
  borderRadius: 24,
  padding: "20px 24px",
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
  padding: "8px 18px",
  borderRadius: 20,
  border: "none",
  background: bg,
  color: "white",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: 600,
});
