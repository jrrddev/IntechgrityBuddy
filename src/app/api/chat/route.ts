import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { generateTutorReply } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth";
import { getDb, getTodayDateString } from "@/lib/db";

function formatQuota(user: {
  daily_used: number;
  daily_limit: number;
  total_used: number;
  total_limit: number;
}) {
  return {
    daily_used: user.daily_used,
    daily_limit: user.daily_limit,
    total_used: user.total_used,
    total_limit: user.total_limit,
  };
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    const result = await db.execute({
      sql: "SELECT id, user_id, role, content, html_context, css_context, created_at FROM messages WHERE user_id = ? ORDER BY created_at ASC LIMIT 100",
      args: [user.id],
    });

    const messages = result.rows.map((row) => ({
      id: String(row.id),
      user_id: String(row.user_id),
      role: row.role === "assistant" ? "assistant" : "user",
      content: String(row.content),
      html_context: String(row.html_context ?? ""),
      css_context: String(row.css_context ?? ""),
      created_at: String(row.created_at),
    }));

    return NextResponse.json({
      messages,
      quota: formatQuota(user),
    });
  } catch (error) {
    console.error("Chat GET error:", error);
    return NextResponse.json(
      { error: "Failed to load chat history." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.daily_limit !== -1 && user.daily_used >= user.daily_limit) {
      return NextResponse.json(
        {
          error: `You've reached your daily chat limit (${user.daily_limit} messages). Ask your teacher/admin if you need more today!`,
          quota: formatQuota(user),
        },
        { status: 429 }
      );
    }

    if (user.total_limit !== -1 && user.total_used >= user.total_limit) {
      return NextResponse.json(
        {
          error: `You've reached your total message allowance (${user.total_limit} messages). Please ask your teacher/admin to top up your limit.`,
          quota: formatQuota(user),
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const question = String(body.message || "").trim();
    const htmlCode =
      typeof body.htmlCode === "string" ? body.htmlCode : user.saved_html;
    const cssCode =
      typeof body.cssCode === "string" ? body.cssCode : user.saved_css;
    const includeCode = body.includeCode !== false;

    if (!question) {
      return NextResponse.json(
        { error: "Please enter a question for IntechgrityBuddy." },
        { status: 400 }
      );
    }

    const db = getDb();

    // Persist latest HTML/CSS workspace code
    await db.execute({
      sql: "UPDATE users SET saved_html = ?, saved_css = ? WHERE id = ?",
      args: [htmlCode, cssCode, user.id],
    });

    // Fetch last 8 messages for conversational continuity
    const historyResult = await db.execute({
      sql: "SELECT role, content FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 8",
      args: [user.id],
    });
    const history = historyResult.rows
      .slice()
      .reverse()
      .map((row) => ({
        role: (row.role === "assistant" ? "assistant" : "user") as
          | "user"
          | "assistant",
        content: String(row.content),
      }));

    const aiResult = await generateTutorReply({
      question,
      htmlCode,
      cssCode,
      includeCode,
      history,
    });

    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();
    const userTime = new Date().toISOString();
    const assistantTime = new Date(Date.now() + 1).toISOString();
    const today = getTodayDateString();

    await db.batch(
      [
        {
          sql: `INSERT INTO messages (id, user_id, role, content, html_context, css_context, created_at)
                VALUES (?, ?, 'user', ?, ?, ?, ?)`,
          args: [
            userMsgId,
            user.id,
            question,
            includeCode ? htmlCode : "",
            includeCode ? cssCode : "",
            userTime,
          ],
        },
        {
          sql: `INSERT INTO messages (id, user_id, role, content, html_context, css_context, created_at)
                VALUES (?, ?, 'assistant', ?, '', '', ?)`,
          args: [assistantMsgId, user.id, aiResult.reply, assistantTime],
        },
        {
          sql: `UPDATE users
                SET daily_used = daily_used + 1,
                    total_used = total_used + 1,
                    last_usage_date = ?
                WHERE id = ?`,
          args: [today, user.id],
        },
      ],
      "write"
    );

    const updatedQuota = {
      daily_used: user.daily_used + 1,
      daily_limit: user.daily_limit,
      total_used: user.total_used + 1,
      total_limit: user.total_limit,
    };

    return NextResponse.json({
      userMessage: {
        id: userMsgId,
        user_id: user.id,
        role: "user",
        content: question,
        html_context: includeCode ? htmlCode : "",
        css_context: includeCode ? cssCode : "",
        created_at: userTime,
      },
      assistantMessage: {
        id: assistantMsgId,
        user_id: user.id,
        role: "assistant",
        content: aiResult.reply,
        html_context: "",
        css_context: "",
        created_at: assistantTime,
      },
      provider: aiResult.provider,
      model: aiResult.model,
      quota: updatedQuota,
    });
  } catch (error) {
    console.error("Chat POST error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Something went wrong while contacting the AI tutor.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    await db.execute({
      sql: "DELETE FROM messages WHERE user_id = ?",
      args: [user.id],
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Chat DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to clear chat history." },
      { status: 500 }
    );
  }
}

