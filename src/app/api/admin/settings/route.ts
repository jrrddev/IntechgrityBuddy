import { NextRequest, NextResponse } from "next/server";
import { getAiSettings, type AiProvider } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden: Admin access required." },
      { status: 403 }
    );
  }
  return null;
}

export async function GET() {
  try {
    const authErr = await requireAdmin();
    if (authErr) return authErr;

    const settings = await getAiSettings();
    return NextResponse.json({
      settings: {
        ai_provider: settings.ai_provider,
        ai_model: settings.ai_model,
        has_gemini_key: Boolean(settings.gemini_api_key),
        has_groq_key: Boolean(settings.groq_api_key),
        has_openrouter_key: Boolean(settings.openrouter_api_key),
        default_daily_limit: settings.default_daily_limit,
        default_total_limit: settings.default_total_limit,
        custom_instructions: settings.custom_instructions,
      },
    });
  } catch (error) {
    console.error("Admin settings GET error:", error);
    return NextResponse.json(
      { error: "Failed to load settings." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authErr = await requireAdmin();
    if (authErr) return authErr;

    const body = await req.json();
    const db = getDb();

    const upserts: Array<[string, string]> = [];

    if (typeof body.ai_provider === "string") {
      const provider = body.ai_provider.toLowerCase();
      if (
        provider === "gemini" ||
        provider === "groq" ||
        provider === "openrouter"
      ) {
        upserts.push(["ai_provider", provider as AiProvider]);
      }
    }

    if (typeof body.ai_model === "string" && body.ai_model.trim()) {
      upserts.push(["ai_model", body.ai_model.trim()]);
    }

    if (typeof body.gemini_api_key === "string" && body.gemini_api_key.trim()) {
      upserts.push(["gemini_api_key", body.gemini_api_key.trim()]);
    }

    if (typeof body.groq_api_key === "string" && body.groq_api_key.trim()) {
      upserts.push(["groq_api_key", body.groq_api_key.trim()]);
    }

    if (
      typeof body.openrouter_api_key === "string" &&
      body.openrouter_api_key.trim()
    ) {
      upserts.push(["openrouter_api_key", body.openrouter_api_key.trim()]);
    }

    if (body.clear_gemini_key === true) upserts.push(["gemini_api_key", ""]);
    if (body.clear_groq_key === true) upserts.push(["groq_api_key", ""]);
    if (body.clear_openrouter_key === true)
      upserts.push(["openrouter_api_key", ""]);

    if (body.default_daily_limit !== undefined) {
      const val = Math.trunc(Number(body.default_daily_limit));
      if (Number.isFinite(val) && val >= -1) {
        upserts.push(["default_daily_limit", String(val)]);
      }
    }

    if (body.default_total_limit !== undefined) {
      const val = Math.trunc(Number(body.default_total_limit));
      if (Number.isFinite(val) && val >= -1) {
        upserts.push(["default_total_limit", String(val)]);
      }
    }

    if (typeof body.custom_instructions === "string") {
      upserts.push(["custom_instructions", body.custom_instructions]);
    }

    if (upserts.length > 0) {
      await db.batch(
        upserts.map(([key, value]) => ({
          sql: "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
          args: [key, value],
        })),
        "write"
      );
    }

    const updated = await getAiSettings();
    return NextResponse.json({
      settings: {
        ai_provider: updated.ai_provider,
        ai_model: updated.ai_model,
        has_gemini_key: Boolean(updated.gemini_api_key),
        has_groq_key: Boolean(updated.groq_api_key),
        has_openrouter_key: Boolean(updated.openrouter_api_key),
        default_daily_limit: updated.default_daily_limit,
        default_total_limit: updated.default_total_limit,
        custom_instructions: updated.custom_instructions,
      },
    });
  } catch (error) {
    console.error("Admin settings PUT error:", error);
    return NextResponse.json(
      { error: "Failed to save settings." },
      { status: 500 }
    );
  }
}

