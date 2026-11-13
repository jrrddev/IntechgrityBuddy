import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import {
  DEFAULT_STARTER_CSS,
  DEFAULT_STARTER_HTML,
  getDb,
  getTodayDateString,
  mapUserRow,
} from "@/lib/db";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      errorResponse: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
      admin: null,
    };
  }
  if (user.role !== "admin") {
    return {
      errorResponse: NextResponse.json(
        { error: "Forbidden: Admin access required." },
        { status: 403 }
      ),
      admin: null,
    };
  }
  return { errorResponse: null, admin: user };
}

export async function GET() {
  try {
    const { errorResponse } = await requireAdmin();
    if (errorResponse) return errorResponse;

    const db = getDb();
    const today = getTodayDateString();
    const usersResult = await db.execute(
      `SELECT u.*,
              (SELECT COUNT(*) FROM messages m WHERE m.user_id = u.id AND m.role = 'user') AS message_count
       FROM users u
       ORDER BY u.role ASC, u.created_at DESC`
    );

    const users = usersResult.rows.map((row) => {
      const mapped = mapUserRow(row as unknown as Record<string, unknown>);
      const effectiveDailyUsed =
        mapped.last_usage_date === today ? mapped.daily_used : 0;
      return {
        id: mapped.id,
        username: mapped.username,
        display_name: mapped.display_name,
        role: mapped.role,
        is_active: mapped.is_active === 1,
        daily_limit: mapped.daily_limit,
        total_limit: mapped.total_limit,
        daily_used: effectiveDailyUsed,
        total_used: mapped.total_used,
        last_usage_date: mapped.last_usage_date,
        message_count: Number(row.message_count ?? 0),
        created_at: mapped.created_at,
      };
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Admin users GET error:", error);
    return NextResponse.json(
      { error: "Failed to load users." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { errorResponse } = await requireAdmin();
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const username = String(body.username || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "");
    const displayName = String(body.display_name || "").trim();
    const password = String(body.password || "");
    const role = body.role === "admin" ? "admin" : "student";
    const dailyLimit = Number.isFinite(Number(body.daily_limit))
      ? Math.trunc(Number(body.daily_limit))
      : 20;
    const totalLimit = Number.isFinite(Number(body.total_limit))
      ? Math.trunc(Number(body.total_limit))
      : 100;

    if (!username || username.length < 2) {
      return NextResponse.json(
        { error: "Username must be at least 2 characters (letters, numbers, ., _, -)." },
        { status: 400 }
      );
    }

    if (!displayName) {
      return NextResponse.json(
        { error: "Display name is required." },
        { status: 400 }
      );
    }

    if (!password || password.length < 4) {
      return NextResponse.json(
        { error: "Password must be at least 4 characters." },
        { status: 400 }
      );
    }

    const db = getDb();
    const existing = await db.execute({
      sql: "SELECT id FROM users WHERE username = ? LIMIT 1",
      args: [username],
    });
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: `Username "${username}" is already taken.` },
        { status: 409 }
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const today = getTodayDateString();

    await db.execute({
      sql: `INSERT INTO users (
        id, username, display_name, password_hash, role, is_active,
        daily_limit, total_limit, daily_used, total_used, last_usage_date,
        saved_html, saved_css, created_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, 0, 0, ?, ?, ?, ?)`,
      args: [
        id,
        username,
        displayName,
        hashPassword(password),
        role,
        dailyLimit,
        totalLimit,
        today,
        DEFAULT_STARTER_HTML,
        DEFAULT_STARTER_CSS,
        now,
      ],
    });

    return NextResponse.json(
      {
        user: {
          id,
          username,
          display_name: displayName,
          role,
          is_active: true,
          daily_limit: dailyLimit,
          total_limit: totalLimit,
          daily_used: 0,
          total_used: 0,
          last_usage_date: today,
          message_count: 0,
          created_at: now,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin users POST error:", error);
    return NextResponse.json(
      { error: "Failed to create account." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { errorResponse, admin } = await requireAdmin();
    if (errorResponse || !admin) return errorResponse!;

    const body = await req.json();
    const userId = String(body.id || "").trim();
    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required." },
        { status: 400 }
      );
    }

    const db = getDb();
    const existingRes = await db.execute({
      sql: "SELECT * FROM users WHERE id = ? LIMIT 1",
      args: [userId],
    });
    if (existingRes.rows.length === 0) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const target = mapUserRow(
      existingRes.rows[0] as unknown as Record<string, unknown>
    );

    const updates: string[] = [];
    const args: Array<string | number> = [];

    if (typeof body.display_name === "string" && body.display_name.trim()) {
      updates.push("display_name = ?");
      args.push(body.display_name.trim());
    }

    if (body.daily_limit !== undefined) {
      const val = Math.trunc(Number(body.daily_limit));
      if (!Number.isFinite(val) || val < -1) {
        return NextResponse.json(
          { error: "Daily limit must be -1 (unlimited) or 0+." },
          { status: 400 }
        );
      }
      updates.push("daily_limit = ?");
      args.push(val);
    }

    if (body.total_limit !== undefined) {
      const val = Math.trunc(Number(body.total_limit));
      if (!Number.isFinite(val) || val < -1) {
        return NextResponse.json(
          { error: "Total limit must be -1 (unlimited) or 0+." },
          { status: 400 }
        );
      }
      updates.push("total_limit = ?");
      args.push(val);
    }

    if (typeof body.is_active === "boolean") {
      if (target.id === admin.id && !body.is_active) {
        return NextResponse.json(
          { error: "You cannot disable your own admin account." },
          { status: 400 }
        );
      }
      updates.push("is_active = ?");
      args.push(body.is_active ? 1 : 0);
    }

    if (typeof body.password === "string" && body.password.trim()) {
      if (body.password.trim().length < 4) {
        return NextResponse.json(
          { error: "New password must be at least 4 characters." },
          { status: 400 }
        );
      }
      updates.push("password_hash = ?");
      args.push(hashPassword(body.password.trim()));
    }

    if (body.reset_daily === true) {
      updates.push("daily_used = 0");
      updates.push("last_usage_date = ?");
      args.push(getTodayDateString());
    }

    if (body.reset_total === true) {
      updates.push("total_used = 0");
    }

    if (updates.length > 0) {
      args.push(userId);
      await db.execute({
        sql: `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
        args,
      });
    }

    if (body.clear_messages === true) {
      await db.execute({
        sql: "DELETE FROM messages WHERE user_id = ?",
        args: [userId],
      });
    }

    const updatedRes = await db.execute({
      sql: "SELECT * FROM users WHERE id = ? LIMIT 1",
      args: [userId],
    });
    const updated = mapUserRow(
      updatedRes.rows[0] as unknown as Record<string, unknown>
    );

    return NextResponse.json({
      user: {
        id: updated.id,
        username: updated.username,
        display_name: updated.display_name,
        role: updated.role,
        is_active: updated.is_active === 1,
        daily_limit: updated.daily_limit,
        total_limit: updated.total_limit,
        daily_used: updated.daily_used,
        total_used: updated.total_used,
        last_usage_date: updated.last_usage_date,
        created_at: updated.created_at,
      },
    });
  } catch (error) {
    console.error("Admin users PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update user." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { errorResponse, admin } = await requireAdmin();
    if (errorResponse || !admin) return errorResponse!;

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("id")?.trim() || "";

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required." },
        { status: 400 }
      );
    }

    if (userId === admin.id) {
      return NextResponse.json(
        { error: "You cannot delete your own active admin account." },
        { status: 400 }
      );
    }

    const db = getDb();
    await db.batch(
      [
        { sql: "DELETE FROM messages WHERE user_id = ?", args: [userId] },
        { sql: "DELETE FROM users WHERE id = ?", args: [userId] },
      ],
      "write"
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin users DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete user." },
      { status: 500 }
    );
  }
}

