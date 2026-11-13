import { createClient, type Client } from "@libsql/client";
import crypto from "crypto";

export const DEFAULT_STARTER_HTML = `<!DOCTYPE html>
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

export const DEFAULT_STARTER_CSS = `body {
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

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  role: "admin" | "student";
  is_active: number;
  daily_limit: number;
  total_limit: number;
  daily_used: number;
  total_used: number;
  last_usage_date: string;
  saved_html: string;
  saved_css: string;
  created_at: string;
}

export interface MessageRow {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  html_context: string;
  css_context: string;
  created_at: string;
}

export function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, "hex");
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

const globalForDb = globalThis as unknown as {
  tursoClient?: Client;
  dbInitPromise?: Promise<void>;
};

export function getDb(): Client {
  if (!globalForDb.tursoClient) {
    const configuredUrl = process.env.TURSO_DATABASE_URL?.trim() || "";
    const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;
    const isRemote =
      configuredUrl.startsWith("libsql://") ||
      configuredUrl.startsWith("https://") ||
      configuredUrl.startsWith("http://");

    let url = configuredUrl || "file:local.db";
    if (isRemote && !authToken) {
      console.warn(
        "[IntechgrityBuddy] Remote TURSO_DATABASE_URL is set without TURSO_AUTH_TOKEN. Falling back to file:local.db until TURSO_AUTH_TOKEN is configured."
      );
      url = "file:local.db";
    }

    globalForDb.tursoClient = createClient({
      url,
      authToken: url.startsWith("file:") ? undefined : authToken,
    });
  }
  return globalForDb.tursoClient;
}

async function runSchemaAndSeed(): Promise<void> {
  const db = getDb();

  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
        is_active INTEGER NOT NULL DEFAULT 1,
        daily_limit INTEGER NOT NULL DEFAULT 20,
        total_limit INTEGER NOT NULL DEFAULT 100,
        daily_used INTEGER NOT NULL DEFAULT 0,
        total_used INTEGER NOT NULL DEFAULT 0,
        last_usage_date TEXT DEFAULT '',
        saved_html TEXT DEFAULT '',
        saved_css TEXT DEFAULT '',
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        html_context TEXT DEFAULT '',
        css_context TEXT DEFAULT '',
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_messages_user_created ON messages(user_id, created_at)`,
    ],
    "write"
  );

  // Seed default admin if none exists
  const adminCheck = await db.execute(
    "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
  );

  if (adminCheck.rows.length === 0) {
    const adminUsername = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT OR IGNORE INTO users (
        id, username, display_name, password_hash, role, is_active,
        daily_limit, total_limit, daily_used, total_used, last_usage_date,
        saved_html, saved_css, created_at
      ) VALUES (?, ?, ?, ?, 'admin', 1, -1, -1, 0, 0, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        adminUsername,
        "Class Admin",
        hashPassword(adminPassword),
        getTodayDateString(),
        DEFAULT_STARTER_HTML,
        DEFAULT_STARTER_CSS,
        now,
      ],
    });
  }

  // Seed default settings if absent
  const defaultSettings: Array<[string, string]> = [
    ["ai_provider", process.env.AI_PROVIDER || "gemini"],
    ["ai_model", "gemini-3.5-flash"],
    ["default_daily_limit", "20"],
    ["default_total_limit", "100"],
    [
      "custom_instructions",
      "Encourage semantic HTML5 tags (<header>, <nav>, <main>, <section>, <footer>) and clean CSS layouts for student portfolios.",
    ],
  ];

  for (const [key, value] of defaultSettings) {
    await db.execute({
      sql: "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
      args: [key, value],
    });
  }
}

export async function ensureDbInitialized(): Promise<void> {
  if (!globalForDb.dbInitPromise) {
    globalForDb.dbInitPromise = runSchemaAndSeed().catch((err) => {
      globalForDb.dbInitPromise = undefined;
      throw err;
    });
  }
  await globalForDb.dbInitPromise;
}

export function mapUserRow(row: Record<string, unknown>): UserRow {
  return {
    id: String(row.id),
    username: String(row.username),
    display_name: String(row.display_name),
    password_hash: String(row.password_hash),
    role: row.role === "admin" ? "admin" : "student",
    is_active: Number(row.is_active ?? 1),
    daily_limit: Number(row.daily_limit ?? 20),
    total_limit: Number(row.total_limit ?? 100),
    daily_used: Number(row.daily_used ?? 0),
    total_used: Number(row.total_used ?? 0),
    last_usage_date: String(row.last_usage_date ?? ""),
    saved_html: String(row.saved_html ?? ""),
    saved_css: String(row.saved_css ?? ""),
    created_at: String(row.created_at ?? ""),
  };
}

