import { getDb } from "./db";

export type AiProvider = "gemini" | "groq" | "openrouter";
export type ServerChoice = "server1" | "server2" | "server3";

export const SERVER_TO_PROVIDER: Record<ServerChoice, AiProvider> = {
  server1: "gemini",
  server2: "groq",
  server3: "openrouter",
};

const SERVER_LABELS: Record<ServerChoice, string> = {
  server1: "Server 1",
  server2: "Server 2",
  server3: "Server 3",
};

export interface AiSettings {
  ai_provider: AiProvider;
  ai_model: string;
  gemini_api_key: string;
  groq_api_key: string;
  openrouter_api_key: string;
  default_daily_limit: number;
  default_total_limit: number;
  custom_instructions: string;
}

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  gemini: "gemini-3.5-flash",
  groq: "openai/gpt-oss-120b",
  openrouter: "openrouter/free",
};

export async function getAiSettings(): Promise<AiSettings> {
  const db = getDb();
  const result = await db.execute("SELECT key, value FROM settings");
  const map = new Map<string, string>();
  for (const row of result.rows) {
    map.set(String(row.key), String(row.value));
  }

  const rawProvider = (
    map.get("ai_provider") ||
    process.env.AI_PROVIDER ||
    "gemini"
  ).toLowerCase();

  const ai_provider: AiProvider =
    rawProvider === "groq" || rawProvider === "openrouter"
      ? rawProvider
      : "gemini";

  const ai_model =
    map.get("ai_model")?.trim() || DEFAULT_MODELS[ai_provider];

  return {
    ai_provider,
    ai_model,
    gemini_api_key:
      map.get("gemini_api_key")?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      "",
    groq_api_key:
      map.get("groq_api_key")?.trim() ||
      process.env.GROQ_API_KEY?.trim() ||
      "",
    openrouter_api_key:
      map.get("openrouter_api_key")?.trim() ||
      process.env.OPENROUTER_API_KEY?.trim() ||
      "",
    default_daily_limit: Number(map.get("default_daily_limit") ?? 20),
    default_total_limit: Number(map.get("default_total_limit") ?? 100),
    custom_instructions: map.get("custom_instructions") ?? "",
  };
}

export function buildSystemPrompt(params: {
  htmlCode: string;
  cssCode: string;
  includeCode: boolean;
  customInstructions: string;
}): string {
  const { htmlCode, cssCode, includeCode, customInstructions } = params;

  const basePrompt = [
    "You are IntechgrityBuddy, a warm, encouraging, and super clear HTML & CSS tutor helping students build their personal portfolio websites in class.",
    "",
    "How you must answer:",
    "1. SIMPLE & UNDERSTANDABLE: Explain concepts in plain, beginner-friendly language first. Keep sentences short and avoid overwhelming jargon. If you use a technical term (like 'selector' or 'Flexbox'), briefly explain what it means.",
    "2. ACCURATE & SPECIFIC: Check the student's actual HTML tags, class names, IDs, and CSS rules carefully. Never guess or invent elements that aren't in their code.",
    "3. SEPARATE HTML & CSS CLEARLY: Students keep their HTML (index.html) and CSS (style.css) in separate tabs. Always put HTML fixes in a ```html code block and CSS fixes in a ```css code block, and tell them which file each snippet belongs in.",
    "4. EXPLAIN WHY: Briefly explain why the issue happened or why your suggested fix works so they genuinely learn.",
    "5. STAY FOCUSED: Keep answers practical, encouraging, and directly helpful for their portfolio lesson.",
  ];

  if (customInstructions.trim()) {
    basePrompt.push("", `Class Teacher Notes: ${customInstructions.trim()}`);
  }

  if (includeCode) {
    const trimmedHtml = htmlCode.trim();
    const trimmedCss = cssCode.trim();
    basePrompt.push(
      "",
      "Below is the student's current workspace code provided separately for context:",
      "",
      "=== STUDENT'S CURRENT HTML (index.html) ===",
      trimmedHtml ? trimmedHtml : "(empty - student has not added HTML yet)",
      "",
      "=== STUDENT'S CURRENT CSS (style.css) ===",
      trimmedCss ? trimmedCss : "(empty - student has not added CSS yet)"
    );
  }

  return basePrompt.join("\n");
}

interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export async function generateTutorReply(params: {
  question: string;
  htmlCode: string;
  cssCode: string;
  includeCode: boolean;
  history: ChatHistoryItem[];
  server?: ServerChoice;
}): Promise<{ reply: string; provider: AiProvider; model: string; server: ServerChoice }> {
  const settings = await getAiSettings();
  const systemPrompt = buildSystemPrompt({
    htmlCode: params.htmlCode,
    cssCode: params.cssCode,
    includeCode: params.includeCode,
    customInstructions: settings.custom_instructions,
  });

  const server: ServerChoice =
    params.server && params.server in SERVER_TO_PROVIDER
      ? params.server
      : settings.ai_provider === "groq"
      ? "server2"
      : settings.ai_provider === "openrouter"
      ? "server3"
      : "server1";

  const provider = SERVER_TO_PROVIDER[server];
  const serverLabel = SERVER_LABELS[server];
  const model =
    settings.ai_provider === provider && settings.ai_model
      ? settings.ai_model
      : DEFAULT_MODELS[provider];

  if (provider === "gemini") {
    if (!settings.gemini_api_key) {
      throw new Error(
        `${serverLabel} is not configured yet. Please try another server or contact your Admin.`
      );
    }
    const reply = await callGemini({
      apiKey: settings.gemini_api_key,
      model,
      systemPrompt,
      history: params.history,
      question: params.question,
      serverLabel,
    });
    return { reply, provider, model, server };
  }

  if (provider === "groq") {
    if (!settings.groq_api_key) {
      throw new Error(
        `${serverLabel} is not configured yet. Please try another server or contact your Admin.`
      );
    }
    const reply = await callOpenAICompatible({
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: settings.groq_api_key,
      model,
      systemPrompt,
      history: params.history,
      question: params.question,
      serverLabel,
    });
    return { reply, provider, model, server };
  }

  // OpenRouter
  if (!settings.openrouter_api_key) {
    throw new Error(
      `${serverLabel} is not configured yet. Please try another server or contact your Admin.`
    );
  }
  const reply = await callOpenAICompatible({
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    apiKey: settings.openrouter_api_key,
    model,
    systemPrompt,
    history: params.history,
    question: params.question,
    serverLabel,
    extraHeaders: {
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "IntechgrityBuddy",
    },
  });
  return { reply, provider, model, server };
}

async function callGemini(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  history: ChatHistoryItem[];
  question: string;
  serverLabel: string;
}): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    params.model
  )}:generateContent?key=${encodeURIComponent(params.apiKey)}`;

  const contents = [
    ...params.history.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    })),
    {
      role: "user",
      parts: [{ text: params.question }],
    },
  ];

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: params.systemPrompt }],
      },
      contents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 8192,
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const errMsg =
      data?.error?.message ||
      `${params.serverLabel} error (${response.status})`;
    throw new Error(
      `${params.serverLabel} is temporarily unavailable (${errMsg}). Try switching servers!`
    );
  }

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.filter((p: { thought?: boolean }) => !p.thought)
      ?.map((p: { text?: string }) => p.text || "")
      .join("")
      .trim() || "";

  if (!text) {
    throw new Error(
      `${params.serverLabel} returned an empty response. Please try again or switch servers.`
    );
  }
  return text;
}

async function callOpenAICompatible(params: {
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  history: ChatHistoryItem[];
  question: string;
  serverLabel: string;
  extraHeaders?: Record<string, string>;
}): Promise<string> {
  const messages = [
    { role: "system", content: params.systemPrompt },
    ...params.history.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user", content: params.question },
  ];

  const response = await fetch(params.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
      ...(params.extraHeaders || {}),
    },
    body: JSON.stringify({
      model: params.model,
      messages,
      temperature: 0.4,
      max_tokens: 4096,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const errMsg =
      data?.error?.message ||
      `${params.serverLabel} error (${response.status})`;
    throw new Error(
      `${params.serverLabel} is temporarily unavailable (${errMsg}). Try switching servers!`
    );
  }

  const text = data?.choices?.[0]?.message?.content?.trim() || "";
  if (!text) {
    throw new Error(
      `${params.serverLabel} returned an empty response. Please try again or switch servers.`
    );
  }
  return text;
}

