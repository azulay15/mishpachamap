"use client";

import { useEffect, useRef, useState } from "react";
import { MMIcon } from "@/lib/icons";
import { usePersona } from "@/lib/usePersona";

type Role = "user" | "assistant";
type Msg = { role: Role; text: string; sources?: string[]; toolCalls?: string[] };

const HISTORY_KEY = "mishpachamap.chat.v1";

const SUGGESTIONS = [
  "מה ההבדל בין השבטים למוריה לעניין משפחות צעירות?",
  "איפה תוכלו ללכת ברגל לבית הכנסת?",
  "תראו לי שכונות עם פארק מתחת ל-5 דק׳ הליכה",
  "אילו שכונות מתאימות למשפחה עם ילד צליאק?",
];

export function AIRail() {
  const persona = usePersona();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load chat history on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (raw) setMessages(JSON.parse(raw) as Msg[]);
    } catch {
      /* ignore */
    }
  }, []);

  // Persist + auto-scroll.
  useEffect(() => {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function send(text: string) {
    if (!text.trim() || pending) return;
    const next: Msg[] = [...messages, { role: "user", text }];
    setMessages(next);
    setInput("");
    setPending(true);
    setActiveTool(null);
    setSetupError(null);
    setRuntimeError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.text })),
          persona,
        }),
      });

      if (res.status === 503) {
        const { error } = (await res.json()) as { error: string };
        setSetupError(error);
        setPending(false);
        return;
      }
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      const toolCalls: string[] = [];
      let sources: string[] = [];

      // Add an empty assistant placeholder we'll update as text arrives.
      setMessages([...next, { role: "assistant", text: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: { type: string; [k: string]: unknown };
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }
          if (event.type === "tool_call") {
            const name = String(event.name);
            toolCalls.push(name);
            setActiveTool(name);
            // The assistant text starts over after a tool call returns.
            assistantText = "";
          } else if (event.type === "text_delta") {
            assistantText += String(event.delta);
            setMessages([...next, { role: "assistant", text: assistantText }]);
            setActiveTool(null);
          } else if (event.type === "sources") {
            sources = (event.sources as string[]) ?? [];
          } else if (event.type === "error") {
            setRuntimeError(String(event.message));
          }
        }
      }

      setMessages([
        ...next,
        { role: "assistant", text: assistantText, sources, toolCalls },
      ]);
    } catch (e) {
      setMessages([
        ...next,
        { role: "assistant", text: `שגיאה: ${(e as Error).message}` },
      ]);
    } finally {
      setPending(false);
      setActiveTool(null);
    }
  }

  const clearHistory = () => {
    setMessages([]);
    window.localStorage.removeItem(HISTORY_KEY);
  };

  return (
    <aside style={asideStyle}>
      <header
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--stroke-weak)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div className="mm-ai-pill" style={{ marginBottom: 4 }}>
            <span className="glyph" /> מומחה השכונה
          </div>
          <div style={{ fontSize: 11, color: "var(--grey-500)" }}>
            תשובות מבוססות נתונים על מודיעין בלבד
          </div>
        </div>
        <button
          type="button"
          onClick={clearHistory}
          className="mm-btn mm-btn-ghost mm-btn-sm"
          aria-label="נקה היסטוריה"
          title="נקה היסטוריה"
          disabled={messages.length === 0}
          style={{ padding: 6 }}
        >
          <MMIcon name="x" size={14} />
        </button>
      </header>

      <div ref={scrollRef} className="mm-scroll" style={{ overflow: "auto", padding: 16 }}>
        {setupError && <SetupCard error={setupError} />}
        {runtimeError && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              background: "var(--red-bg)",
              border: "1px solid rgba(217,20,0,0.2)",
              color: "var(--red-negative)",
              fontSize: 12,
              marginBottom: 10,
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
            }}
            role="alert"
          >
            <MMIcon name="info" size={14} color="var(--red-negative)" />
            <div style={{ flex: 1, lineHeight: "16px" }}>
              <strong style={{ display: "block", marginBottom: 2 }}>שגיאה בשרת</strong>
              {runtimeError}
            </div>
          </div>
        )}

        {messages.length === 0 && !setupError && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              background: "var(--grey-10)",
              fontSize: 13,
              color: "var(--grey-700)",
              lineHeight: "18px",
            }}
          >
            שלום! אני מומחה השכונה של מודיעין. שאלו אותי על שכונות, מחירים, בתי ספר, פארקים — או נסו אחת מההצעות למטה.
          </div>
        )}

        {messages.map((m, i) => (
          <Bubble key={i} msg={m} />
        ))}

        {pending && (
          <div
            style={{
              alignSelf: "flex-start",
              fontSize: 12,
              color: "var(--grey-500)",
              padding: "8px 0",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span className="mm-skel" style={{ width: 6, height: 6, borderRadius: "50%" }} />
            <span className="mm-skel" style={{ width: 6, height: 6, borderRadius: "50%" }} />
            <span className="mm-skel" style={{ width: 6, height: 6, borderRadius: "50%" }} />
            {activeTool && (
              <span style={{ marginInlineStart: 4 }}>
                בודק נתונים: <strong>{activeTool}</strong>
              </span>
            )}
          </div>
        )}
      </div>

      <footer
        style={{
          borderTop: "1px solid var(--stroke-weak)",
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {messages.length === 0 && !setupError && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="mm-chip"
                onClick={() => send(s)}
                style={{ height: 28, fontSize: 11, padding: "0 10px", textAlign: "start" }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          style={{ display: "flex", gap: 6 }}
        >
          <div className="mm-input" style={{ height: 40, flex: 1 }}>
            <MMIcon name="sparkle" size={14} color="var(--pumpkin-orange)" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="שאלו את מומחה השכונה…"
              disabled={pending}
            />
          </div>
          <button
            type="submit"
            className="mm-btn mm-btn-accent"
            disabled={pending || !input.trim()}
            aria-label="שלח"
            style={{ height: 40, padding: "0 12px" }}
          >
            <MMIcon name="send" size={14} color="#fff" />
          </button>
        </form>

        <div style={{ fontSize: 10, color: "var(--grey-500)", textAlign: "center" }}>
          תשובות מבוססות נתונים פתוחים ועסקאות עבר. אינן ייעוץ נדל"ן.
        </div>
      </footer>
    </aside>
  );
}

const asideStyle: React.CSSProperties = {
  background: "#fff",
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr) auto",
  height: "100%",
  minHeight: 0,
  overflow: "hidden",
};

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 10,
      }}
    >
      <div
        style={{
          maxWidth: "92%",
          background: isUser ? "var(--grey-900)" : "var(--grey-10)",
          color: isUser ? "#fff" : "var(--grey-900)",
          borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
          padding: "10px 14px",
          fontSize: 13,
          lineHeight: "18px",
          whiteSpace: "pre-wrap",
        }}
      >
        {msg.text || (
          <span style={{ opacity: 0.5 }}>…</span>
        )}
        {!isUser && msg.sources && msg.sources.length > 0 && (
          <div
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid var(--stroke-weak)",
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
            }}
          >
            {msg.sources.map((s) => (
              <span key={s} className="mm-tag mm-tag-soft" style={{ fontSize: 9 }}>
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SetupCard({ error }: { error: string }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        background: "linear-gradient(180deg, rgba(255,107,0,0.06), rgba(255,107,0,0))",
        border: "1px solid rgba(255,107,0,0.3)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <MMIcon name="info" size={16} color="var(--pumpkin-orange)" />
        <strong style={{ fontSize: 13 }}>נדרשת הגדרת מפתח Anthropic</strong>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "var(--grey-700)", lineHeight: "18px" }}>
        {error}
      </p>
      <ol style={{ margin: "8px 0 0", paddingInlineStart: 18, fontSize: 12, color: "var(--grey-700)" }}>
        <li>פתח <code>console.anthropic.com</code> והפק מפתח API.</li>
        <li>הוסף ל-<code>.env.local</code>: <code>ANTHROPIC_API_KEY=sk-ant-...</code></li>
        <li>הפעל מחדש את <code>npm run dev</code>.</li>
      </ol>
    </div>
  );
}
