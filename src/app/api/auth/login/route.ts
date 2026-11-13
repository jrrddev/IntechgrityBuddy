import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  sanitizeUserForClient,
  SESSION_COOKIE_NAME,
  verifyPassword,
} from "@/lib/auth";
import {
  ensureDbInitialized,
  getDb,
  getTodayDateString,
  mapUserRow,
} from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    await ensureDbInitialized();
    const body = await req.json();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }

    const db = getDb();
    const result = await db.execute({
      sql: "SELECT * FROM users WHERE username = ? LIMIT 1",
      args: [username],
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    const user = mapUserRow(result.rows[0] as unknown as Record<string, unknown>);
    if (!verifyPassword(password, user.password_hash)) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    if (user.is_active !== 1) {
      return NextResponse.json(
        {
          error:
            "Your account is currently disabled. Please contact your instructor/admin.",
        },
        { status: 403 }
      );
    }

    const today = getTodayDateString();
    if (user.last_usage_date !== today) {
      await db.execute({
        sql: "UPDATE users SET daily_used = 0, last_usage_date = ? WHERE id = ?",
        args: [today, user.id],
      });
      user.daily_used = 0;
      user.last_usage_date = today;
    }

    const token = createSessionToken({ userId: user.id, role: user.role });
    const response = NextResponse.json({
      user: sanitizeUserForClient(user),
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Failed to log in. Please try again." },
      { status: 500 }
    );
  }
}

