"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Columns2,
  Copy,
  Eye,
  EyeOff,
  FileCode,
  FileSpreadsheet,
  LogOut,
  Redo2,
  Save,
  Send,
  Shield,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";

interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  role: "admin" | "student";
  daily_limit: number;
  total_limit: number;
  daily_used: number;
  total_used: number;
  saved_html: string;
  saved_css: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  html_context: string;
  css_context: string;
  created_at: string;
}

interface QuotaState {
  daily_used: number;
  daily_limit: number;
  total_used: number;
  total_limit: number;
}

const STARTER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Portfolio</title>
</head>
<body>
  <header class="navbar">
    <h1 class="logo">Alex Rivera</h1>
    <nav class="nav-links">
      <a href="#about">About</a>
      <a href="#projects">Projects</a>
      <a href="#contact">Contact</a>
    </nav>
  </header>

  <section id="about" class="hero">
    <h2>Hi, I'm Alex!</h2>
    <p>I am a student learning HTML and CSS to build clean, creative websites.</p>
    <a href="#projects" class="btn">View My Work</a>
  </section>

  <section id="projects" class="projects">
    <h3>My Projects</h3>
    <div class="project-grid">
      <article class="card">
        <h4>Personal Bio Page</h4>
        <p>My very first HTML page using semantic tags and custom fonts.</p>
      </article>
      <article class="card">
        <h4>Photo Gallery</h4>
        <p>A responsive grid layout styled with CSS Flexbox.</p>
      </article>
    </div>
  </section>

  <footer id="contact" class="footer">
    <p>Built with HTML &amp; CSS • 2026</p>
  </footer>
</body>
</html>`;

const STARTER_CSS = `body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  background-color: #f8fafc;
  color: #1e293b;
  line-height: 1.6;
}

.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 32px;
  background-color: #0f172a;
  color: #ffffff;
}

.logo {
  margin: 0;
  font-size: 1.25rem;
}

.nav-links a {
  color: #cbd5e1;
  text-decoration: none;
  margin-left: 20px;
  font-weight: 500;
}

.nav-links a:hover {
  color: #38bdf8;
}

.hero {
  text-align: center;
  padding: 64px 24px;
  background: linear-gradient(135deg, #e0f2fe, #f0fdf4);
}

.btn {
  display: inline-block;
  margin-top: 12px;
  padding: 10px 22px;
  background-color: #2563eb;
  color: #ffffff;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
}

.projects {
  max-width: 900px;
  margin: 40px auto;
  padding: 0 24px;
}

.project-grid {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.card {
  flex: 1 1 260px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.05);
}

.footer {
  text-align: center;
  padding: 24px;
  color: #64748b;
  font-size: 0.9rem;
}`;

const QUICK_PROMPTS = [
  "Why isn't my CSS working on my HTML?",
  "How do I make my project cards sit side-by-side?",
  "Check my portfolio HTML & CSS for mistakes",
  "How do I style my navigation bar cleanly?",
];

function buildPreviewDocument(html: string, css: string): string {
  const styleTag = `<style>\n${css}\n</style>`;
  if (!html.trim()) {
    return `<!DOCTYPE html><html><head>${styleTag}</head><body style="font-family:sans-serif;padding:24px;color:#64748b;"><p>Write some HTML in <strong>index.html</strong> to preview your portfolio here.</p></body></html>`;
  }
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${styleTag}\n</head>`);
  }
  if (/<body/i.test(html)) {
    return `<head>${styleTag}</head>${html}`;
  }
  return `<!DOCTYPE html><html><head><meta charset="UTF-8" />${styleTag}</head><body>${html}</body></html>`;
}

function formatLimit(used: number, limit: number): string {
  if (limit === -1) return `${used} / ∞`;
  return `${used} / ${limit}`;
}

function FormattedTextBlock({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;

        // Simple inline formatting for **bold** and `code`
        const renderInline = (content: string) => {
          const tokens = content.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
          return tokens.map((tok, idx) => {
            if (tok.startsWith("`") && tok.endsWith("`") && tok.length >= 2) {
              return (
                <code
                  key={idx}
                  className="px-1.5 py-0.5 rounded bg-slate-200/80 text-indigo-900 font-mono text-xs"
                >
                  {tok.slice(1, -1)}
                </code>
              );
            }
            if (tok.startsWith("**") && tok.endsWith("**") && tok.length >= 4) {
              return (
                <strong key={idx} className="font-semibold text-slate-900">
                  {tok.slice(2, -2)}
                </strong>
              );
            }
            return <span key={idx}>{tok}</span>;
          });
        };

        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={i} className="font-semibold text-slate-900 pt-1">
              {renderInline(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={i} className="font-bold text-slate-900 pt-1">
              {renderInline(trimmed.slice(3))}
            </h3>
          );
        }
        if (/^[-*]\s+/.test(trimmed)) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-indigo-500 font-bold">•</span>
              <span>{renderInline(trimmed.replace(/^[-*]\s+/, ""))}</span>
            </div>
          );
        }
        if (/^\d+\.\s+/.test(trimmed)) {
          const match = trimmed.match(/^(\d+\.)\s+(.*)$/);
          if (match) {
            return (
              <div key={i} className="flex gap-2 pl-1">
                <span className="font-semibold text-indigo-700">{match[1]}</span>
                <span>{renderInline(match[2])}</span>
              </div>
            );
          }
        }
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const segments = useMemo(() => {
    const parts: Array<{ type: "text" | "code"; lang?: string; body: string }> =
      [];
    const regex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          body: content.slice(lastIndex, match.index),
        });
      }
      parts.push({
        type: "code",
        lang: match[1]?.toLowerCase() || "code",
        body: match[2].replace(/\n$/, ""),
      });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push({ type: "text", body: content.slice(lastIndex) });
    }
    return parts;
  }, [content]);

  async function handleCopy(code: string, idx: number) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      // Ignore clipboard failures
    }
  }

  return (
    <div className="space-y-3">
      {segments.map((seg, idx) => {
        if (seg.type === "text") {
          return <FormattedTextBlock key={idx} text={seg.body} />;
        }

        const label =
          seg.lang === "html"
            ? "HTML (index.html)"
            : seg.lang === "css"
            ? "CSS (style.css)"
            : (seg.lang || "code").toUpperCase();

        const badgeStyle =
          seg.lang === "html"
            ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
            : seg.lang === "css"
            ? "bg-sky-500/20 text-sky-300 border-sky-500/30"
            : "bg-slate-700 text-slate-300 border-slate-600";

        return (
          <div
            key={idx}
            className="rounded-xl overflow-hidden border border-slate-700 bg-slate-900 text-slate-100"
          >
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700">
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${badgeStyle}`}
              >
                {label}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(seg.body, idx)}
                className="flex items-center gap-1 text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                {copiedIndex === idx ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 overflow-x-auto text-xs font-mono leading-relaxed">
              <code>{seg.body}</code>
            </pre>
          </div>
        );
      })}
    </div>
  );
}

export default function StudentWorkspacePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [htmlCode, setHtmlCode] = useState("");
  const [cssCode, setCssCode] = useState("");
  const [historyState, setHistoryState] = useState<{
    entries: Array<{ html: string; css: string }>;
    index: number;
  }>({ entries: [], index: -1 });
  const [activeTab, setActiveTab] = useState<"html" | "css" | "split">("html");
  const [showPreview, setShowPreview] = useState(true);
  const [previewKey, setPreviewKey] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle"
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [quota, setQuota] = useState<QuotaState>({
    daily_used: 0,
    daily_limit: 20,
    total_used: 0,
    total_limit: 100,
  });
  const [question, setQuestion] = useState("");
  const [includeCode, setIncludeCode] = useState(true);
  const [selectedServer, setSelectedServer] = useState<
    "server1" | "server2" | "server3"
  >("server1");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const initialLoadedRef = useRef(false);

  useEffect(() => {
    async function loadSession() {
      try {
        const meRes = await fetch("/api/auth/me");
        if (meRes.status === 401) {
          router.replace("/login");
          return;
        }
        const meData = await meRes.json();
        if (!meData.user) {
          router.replace("/login");
          return;
        }

        const profile: UserProfile = meData.user;
        const initialHtml = profile.saved_html || STARTER_HTML;
        const initialCss = profile.saved_css || STARTER_CSS;
        setUser(profile);
        setHtmlCode(initialHtml);
        setCssCode(initialCss);
        setHistoryState({
          entries: [{ html: initialHtml, css: initialCss }],
          index: 0,
        });
        setQuota({
          daily_used: profile.daily_used,
          daily_limit: profile.daily_limit,
          total_used: profile.total_used,
          total_limit: profile.total_limit,
        });

        const chatRes = await fetch("/api/chat");
        if (chatRes.ok) {
          const chatData = await chatRes.json();
          setMessages(chatData.messages || []);
          if (chatData.quota) setQuota(chatData.quota);
        }
        initialLoadedRef.current = true;
      } catch {
        setChatError("Could not connect to server.");
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Gentle auto-save after code edits
  useEffect(() => {
    if (!initialLoadedRef.current || !user) return;
    setSaveStatus("idle");
    const timer = setTimeout(async () => {
      try {
        setSaveStatus("saving");
        await fetch("/api/code", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ htmlCode, cssCode }),
        });
        setSaveStatus("saved");
      } catch {
        setSaveStatus("idle");
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [htmlCode, cssCode, user]);

  async function handleManualSave() {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/code", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ htmlCode, cssCode }),
      });
      if (res.ok) {
        setSaveStatus("saved");
      } else {
        setSaveStatus("idle");
      }
    } catch {
      setSaveStatus("idle");
    }
  }

  function pushHistory(nextHtml: string, nextCss: string) {
    setHistoryState((prev) => {
      const current = prev.entries[prev.index];
      if (current && current.html === nextHtml && current.css === nextCss) {
        return prev;
      }
      const nextEntries = prev.entries.slice(0, prev.index + 1);
      nextEntries.push({ html: nextHtml, css: nextCss });
      if (nextEntries.length > 100) {
        nextEntries.shift();
      }
      return {
        entries: nextEntries,
        index: nextEntries.length - 1,
      };
    });
  }

  function updateHtmlCode(nextHtml: string) {
    setHtmlCode(nextHtml);
    pushHistory(nextHtml, cssCode);
  }

  function updateCssCode(nextCss: string) {
    setCssCode(nextCss);
    pushHistory(htmlCode, nextCss);
  }

  const canUndo = historyState.index > 0;
  const canRedo =
    historyState.index >= 0 &&
    historyState.index < historyState.entries.length - 1;

  function handleUndo() {
    if (!canUndo) return;
    const nextIdx = historyState.index - 1;
    const target = historyState.entries[nextIdx];
    setHtmlCode(target.html);
    setCssCode(target.css);
    setHistoryState((prev) => ({ ...prev, index: nextIdx }));
  }

  function handleRedo() {
    if (!canRedo) return;
    const nextIdx = historyState.index + 1;
    const target = historyState.entries[nextIdx];
    setHtmlCode(target.html);
    setCssCode(target.css);
    setHistoryState((prev) => ({ ...prev, index: nextIdx }));
  }

  async function handleSendQuestion(customPrompt?: string) {
    const text = (customPrompt ?? question).trim();
    if (!text || sending) return;

    setChatError("");
    setSending(true);
    if (!customPrompt) setQuestion("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          htmlCode,
          cssCode,
          includeCode,
          server: selectedServer,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setChatError(data.error || "Could not get an answer right now.");
        if (data.quota) setQuota(data.quota);
        if (!customPrompt) setQuestion(text);
        return;
      }

      setMessages((prev) => [
        ...prev,
        data.userMessage,
        data.assistantMessage,
      ]);
      if (data.quota) setQuota(data.quota);
    } catch {
      setChatError("Network error while contacting IntechgrityBuddy.");
      if (!customPrompt) setQuestion(text);
    } finally {
      setSending(false);
    }
  }

  async function handleClearChat() {
    try {
      const res = await fetch("/api/chat", { method: "DELETE" });
      if (res.ok) {
        setMessages([]);
        setChatError("");
      }
    } catch {
      setChatError("Could not clear chat history.");
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const previewDoc = useMemo(
    () => buildPreviewDocument(htmlCode, cssCode),
    [htmlCode, cssCode]
  );

  const htmlLines = htmlCode ? htmlCode.split("\n").length : 0;
  const cssLines = cssCode ? cssCode.split("\n").length : 0;

  const dailyReached =
    quota.daily_limit !== -1 && quota.daily_used >= quota.daily_limit;
  const totalReached =
    quota.total_limit !== -1 && quota.total_used >= quota.total_limit;
  const isLimitReached = dailyReached || totalReached;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-2">
          <Image
            src="/logo.png"
            alt="IntechgrityBuddy"
            width={48}
            height={48}
            className="w-12 h-12 rounded-xl object-cover animate-pulse mx-auto shadow-sm"
          />
          <p className="text-sm text-slate-500">
            Loading your HTML &amp; CSS studio...
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-slate-100 text-slate-900">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="IntechgrityBuddy logo"
            width={36}
            height={36}
            className="w-9 h-9 rounded-xl object-cover shadow-sm"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-slate-900 text-base leading-none">
                IntechgrityBuddy
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Signed in as{" "}
              <strong className="text-slate-700">{user.display_name}</strong> (@
              {user.username})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quota Badges */}
          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 ${
              dailyReached
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : "bg-slate-50 border-slate-200 text-slate-700"
            }`}
          >
            <span className="text-slate-500">Daily:</span>
            <span className="font-semibold">
              {formatLimit(quota.daily_used, quota.daily_limit)}
            </span>
          </div>

          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 ${
              totalReached
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : "bg-slate-50 border-slate-200 text-slate-700"
            }`}
          >
            <span className="text-slate-500">Total:</span>
            <span className="font-semibold">
              {formatLimit(quota.total_used, quota.total_limit)}
            </span>
          </div>

          {user.role === "admin" && (
            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              Admin Console
            </Link>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      </header>

      {/* Main Two-Column Studio */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3">
        {/* Left Pane: Separate HTML & CSS Editors + Live Preview */}
        <section className="lg:col-span-7 flex flex-col min-h-[540px] lg:min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Editor Toolbar */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab("html")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  activeTab === "html"
                    ? "bg-white text-amber-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-amber-600" />
                index.html
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("css")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  activeTab === "css"
                    ? "bg-white text-sky-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-sky-600" />
                style.css
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("split")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  activeTab === "split"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Columns2 className="w-3.5 h-3.5 text-indigo-600" />
                Both Files
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                title="Undo"
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 text-xs font-medium flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Undo
              </button>

              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                title="Redo"
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 text-xs font-medium flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <Redo2 className="w-3.5 h-3.5" />
                Redo
              </button>

              <button
                type="button"
                onClick={handleManualSave}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium flex items-center gap-1 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-indigo-600" />
                {saveStatus === "saving"
                  ? "Saving..."
                  : saveStatus === "saved"
                  ? "Saved"
                  : "Save"}
              </button>

              <button
                type="button"
                onClick={() => setShowPreview((p) => !p)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                  showPreview
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {showPreview ? (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    Preview On
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    Preview Off
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Editors + Preview Split */}
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Code Editors Area */}
            <div
              className={`min-h-0 ${
                showPreview ? "h-1/2" : "flex-1"
              } grid ${
                activeTab === "split"
                  ? "grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800"
                  : "grid-cols-1"
              } bg-slate-950`}
            >
              {(activeTab === "html" || activeTab === "split") && (
                <div className="flex flex-col min-h-0 h-full">
                  <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5" />
                      index.html
                    </span>
                    <span className="text-slate-400">{htmlLines} lines</span>
                  </div>
                  <textarea
                    value={htmlCode}
                    onChange={(e) => updateHtmlCode(e.target.value)}
                    spellCheck={false}
                    placeholder="Paste or write your HTML code here..."
                    className="flex-1 w-full resize-none bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed p-3 focus:outline-none placeholder:text-slate-600"
                  />
                </div>
              )}

              {(activeTab === "css" || activeTab === "split") && (
                <div className="flex flex-col min-h-0 h-full">
                  <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-sky-300 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      style.css
                    </span>
                    <span className="text-slate-400">{cssLines} lines</span>
                  </div>
                  <textarea
                    value={cssCode}
                    onChange={(e) => updateCssCode(e.target.value)}
                    spellCheck={false}
                    placeholder="Paste or write your CSS styles here..."
                    className="flex-1 w-full resize-none bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed p-3 focus:outline-none placeholder:text-slate-600"
                  />
                </div>
              )}
            </div>

            {/* Live Preview Pane */}
            {showPreview && (
              <div className="h-1/2 min-h-[200px] flex flex-col border-t border-slate-300 bg-white">
                <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewKey((k) => k + 1)}
                      title="Back to your HTML & CSS preview"
                      className="px-2 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      Back
                    </button>
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                      Live Portfolio Preview
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 hidden sm:inline">
                    Combines index.html + style.css automatically
                  </span>
                </div>
                <iframe
                  key={previewKey}
                  title="Live Portfolio Preview"
                  sandbox="allow-scripts"
                  srcDoc={previewDoc}
                  className="flex-1 w-full bg-white border-0"
                />
              </div>
            )}
          </div>
        </section>

        {/* Right Pane: IntechgrityBuddy AI Chat */}
        <section className="lg:col-span-5 flex flex-col min-h-[540px] lg:min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-white/15">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-sm leading-tight">
                  Ask IntechgrityBuddy
                </h2>
                <p className="text-[11px] text-indigo-100">
                  Simple, accurate help for your HTML &amp; CSS portfolio
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                className="flex items-center bg-white/15 p-0.5 rounded-lg text-[11px] font-semibold"
                role="group"
                aria-label="Select AI server"
              >
                {(
                  [
                    { id: "server1", label: "Server 1" },
                    { id: "server2", label: "Server 2" },
                    { id: "server3", label: "Server 3" },
                  ] as const
                ).map((srv) => (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => setSelectedServer(srv.id)}
                    className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                      selectedServer === srv.id
                        ? "bg-white text-indigo-700 shadow-xs"
                        : "text-indigo-100 hover:text-white"
                    }`}
                  >
                    {srv.label}
                  </button>
                ))}
              </div>

              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-slate-50/70">
            {messages.length === 0 ? (
              <div className="py-6 space-y-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                  <p className="text-sm font-semibold text-slate-900 mb-1">
                    Welcome, {user.display_name}! 👋
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Put your HTML in <strong>index.html</strong> and your CSS in{" "}
                    <strong>style.css</strong> on the left. When you ask a
                    question below, both files are sent separately so I can
                    spot typos, explain how things connect, and guide you step
                    by step!
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
                    Try asking:
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        disabled={isLimitReached || sending}
                        onClick={() => handleSendQuestion(prompt)}
                        className="text-left px-3.5 py-2.5 rounded-xl bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-xs font-medium text-slate-700 hover:text-indigo-800 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[92%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white rounded-br-sm"
                        : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-xs"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <div className="space-y-2">
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </p>
                        {(msg.html_context || msg.css_context) && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {msg.html_context && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 text-indigo-100">
                                + index.html
                              </span>
                            )}
                            {msg.css_context && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 text-indigo-100">
                                + style.css
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <MessageContent content={msg.content} />
                    )}
                  </div>
                </div>
              ))
            )}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 text-xs text-slate-500 flex items-center gap-2 shadow-xs">
                  <Sparkles className="w-4 h-4 text-indigo-600 animate-spin" />
                  Reading your HTML &amp; CSS and writing a simple answer...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Composer */}
          <div className="p-3 bg-white border-t border-slate-200 space-y-2.5 shrink-0">
            {chatError && (
              <div className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{chatError}</span>
              </div>
            )}

            {isLimitReached && (
              <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {dailyReached
                    ? `Daily chat limit reached (${quota.daily_limit} messages). Ask your instructor/admin if you need more today.`
                    : `Total message allowance reached (${quota.total_limit} messages). Ask your instructor/admin to top up your limit.`}
                </span>
              </div>
            )}

            {/* Separate HTML + CSS Context Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={includeCode}
                  onChange={(e) => setIncludeCode(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Send HTML &amp; CSS separately as context
              </label>

              {includeCode && (
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-medium">
                    HTML: {htmlLines}L
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 text-[11px] font-medium">
                    CSS: {cssLines}L
                  </span>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendQuestion();
              }}
              className="flex gap-2"
            >
              <textarea
                rows={2}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendQuestion();
                  }
                }}
                disabled={isLimitReached || sending}
                placeholder={
                  isLimitReached
                    ? "Chat limit reached — contact your instructor"
                    : "Ask about your HTML or CSS... (Press Enter to send)"
                }
                className="flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100"
              />
              <button
                type="submit"
                disabled={isLimitReached || sending || !question.trim()}
                className="px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Ask</span>
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
