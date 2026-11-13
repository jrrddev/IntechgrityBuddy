import crypto from "crypto";
import { cookies } from "next/headers";
import {
  ensureDbInitialized,
  getDb,
  getTodayDateString,
  hashPassword,
  mapUserRow,
  verifyPassword,
  type UserRow,
} from "./db";

export { hashPassword, verifyPassword };

export const SESSION_COOKIE_NAME = "intechgrity_session";

interface SessionPayload {
  userId: string;
  role: "admin" | "student";
  exp: number;
}

function getSecret(): string {
  return process.env.JWT_SECRET?.trim() || "intechgrity-buddy-dev-secret-key-2026";
}

export function createSessionToken(payload: {
  userId: string;
  role: "admin" | "student";
}): string {
  const fullPayload: SessionPayload = {
    userId: payload.userId,
    role: payload.role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const data = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

export function verifySessionToken(
  token: string
): { userId: string; role: "admin" | "student" } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", getSecret())
    .update(data)
    .digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8")
    ) as SessionPayload;
    if (!parsed.userId || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return {
      userId: parsed.userId,
      role: parsed.role === "admin" ? "admin" : "student",
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<UserRow | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  await ensureDbInitialized();

  const session = verifySessionToken(token);
  if (!session) return null;

  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM users WHERE id = ? LIMIT 1",
    args: [session.userId],
  });

  if (result.rows.length === 0) return null;
  const user = mapUserRow(result.rows[0] as unknown as Record<string, unknown>);
  if (user.is_active !== 1) return null;

  const today = getTodayDateString();
  if (user.last_usage_date !== today) {
    await db.execute({
      sql: "UPDATE users SET daily_used = 0, last_usage_date = ? WHERE id = ?",
      args: [today, user.id],
    });
    user.daily_used = 0;
    user.last_usage_date = today;
  }

  return user;
}

export function sanitizeUserForClient(user: UserRow) {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    role: user.role,
    is_active: user.is_active === 1,
    daily_limit: user.daily_limit,
    total_limit: user.total_limit,
    daily_used: user.daily_used,
    total_used: user.total_used,
    last_usage_date: user.last_usage_date,
    saved_html: user.saved_html,
    saved_css: user.saved_css,
    created_at: user.created_at,
  };
}
