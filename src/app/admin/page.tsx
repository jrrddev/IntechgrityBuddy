"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Code2,
  KeyRound,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";

interface AdminUserRow {
  id: string;
  username: string;
  display_name: string;
  role: "admin" | "student";
  is_active: boolean;
  daily_limit: number;
  total_limit: number;
  daily_used: number;
  total_used: number;
  message_count: number;
  created_at: string;
}

interface AdminSettings {
  ai_provider: "gemini" | "groq" | "openrouter";
  ai_model: string;
  has_gemini_key: boolean;
  has_groq_key: boolean;
  has_openrouter_key: boolean;
  default_daily_limit: number;
  default_total_limit: number;
  custom_instructions: string;
}

const MODEL_PRESETS: Record<"gemini" | "groq" | "openrouter", string[]> = {
  gemini: ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-flash-latest"],
  groq: [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
  ],
  openrouter: [
    "openrouter/free",
    "google/gemini-2.0-flash-exp:free",
  ],
};

function UsageBar({ used, limit }: { used: number; limit: number }) {
  if (limit === -1) {
    return (
      <div className="space-y-1">
        <div className="text-xs font-semibold text-slate-700">
          {used} / ∞ <span className="text-slate-400 font-normal">(Unlimited)</span>
        </div>
        <div className="h-1.5 w-28 bg-emerald-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 w-1/4 rounded-full" />
        </div>
      </div>
    );
  }

  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const barColor =
    pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-indigo-600";

  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-slate-700">
        {used} / {limit}
      </div>
      <div className="h-1.5 w-28 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"users" | "settings">("users");
  const [currentAdminName, setCurrentAdminName] = useState("Admin");

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [settings, setSettings] = useState<AdminSettings>({
    ai_provider: "gemini",
    ai_model: "gemini-3.5-flash",
    has_gemini_key: false,
    has_groq_key: false,
    has_openrouter_key: false,
    default_daily_limit: 20,
    default_total_limit: 100,
    custom_instructions: "",
  });

  const [banner, setBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Create User Form
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"student" | "admin">("student");
  const [newDailyLimit, setNewDailyLimit] = useState("20");
  const [newDailyUnlimited, setNewDailyUnlimited] = useState(false);
  const [newTotalLimit, setNewTotalLimit] = useState("100");
  const [newTotalUnlimited, setNewTotalUnlimited] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);

  // Edit User Modal
  const [editingUser, setEditingUser] = useState<AdminUserRow | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editDailyLimit, setEditDailyLimit] = useState("20");
  const [editDailyUnlimited, setEditDailyUnlimited] = useState(false);
  const [editTotalLimit, setEditTotalLimit] = useState("100");
  const [editTotalUnlimited, setEditTotalUnlimited] = useState(false);
  const [editPassword, setEditPassword] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Settings form API keys (write-only inputs)
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [groqKeyInput, setGroqKeyInput] = useState("");
  const [openrouterKeyInput, setOpenrouterKeyInput] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  async function refreshAll() {
    const [usersRes, settingsRes] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/settings"),
    ]);

    if (usersRes.ok) {
      const data = await usersRes.json();
      setUsers(data.users || []);
    }
    if (settingsRes.ok) {
      const data = await settingsRes.json();
      if (data.settings) {
        setSettings(data.settings);
        setNewDailyLimit(
          data.settings.default_daily_limit === -1
            ? "20"
            : String(data.settings.default_daily_limit)
        );
        setNewDailyUnlimited(data.settings.default_daily_limit === -1);
        setNewTotalLimit(
          data.settings.default_total_limit === -1
            ? "100"
            : String(data.settings.default_total_limit)
        );
        setNewTotalUnlimited(data.settings.default_total_limit === -1);
      }
    }
  }

  useEffect(() => {
    async function init() {
      try {
        const meRes = await fetch("/api/auth/me");
        if (meRes.status === 401) {
          router.replace("/login");
          return;
        }
        const meData = await meRes.json();
        if (!meData.user || meData.user.role !== "admin") {
          router.replace("/");
          return;
        }
        setCurrentAdminName(meData.user.display_name);
        await refreshAll();
      } catch {
        setBanner({ type: "error", text: "Failed to load admin console." });
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [router]);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    setCreatingUser(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername,
          display_name: newDisplayName,
          password: newPassword,
          role: newRole,
          daily_limit: newDailyUnlimited ? -1 : Number(newDailyLimit),
          total_limit: newTotalUnlimited ? -1 : Number(newTotalLimit),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: "error", text: data.error || "Could not create user." });
        return;
      }

      setNewUsername("");
      setNewDisplayName("");
      setNewPassword("");
      setBanner({
        type: "success",
        text: `Created account @${data.user.username} successfully.`,
      });
      await refreshAll();
    } catch {
      setBanner({ type: "error", text: "Network error while creating account." });
    } finally {
      setCreatingUser(false);
    }
  }

  function openEditModal(u: AdminUserRow) {
    setEditingUser(u);
    setEditDisplayName(u.display_name);
    setEditDailyUnlimited(u.daily_limit === -1);
    setEditDailyLimit(u.daily_limit === -1 ? "20" : String(u.daily_limit));
    setEditTotalUnlimited(u.total_limit === -1);
    setEditTotalLimit(u.total_limit === -1 ? "100" : String(u.total_limit));
    setEditPassword("");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    setBanner(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingUser.id,
          display_name: editDisplayName,
          daily_limit: editDailyUnlimited ? -1 : Number(editDailyLimit),
          total_limit: editTotalUnlimited ? -1 : Number(editTotalLimit),
          ...(editPassword.trim() ? { password: editPassword.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: "error", text: data.error || "Update failed." });
        return;
      }
      setEditingUser(null);
      setBanner({
        type: "success",
        text: `Updated @${editingUser.username}.`,
      });
      await refreshAll();
    } catch {
      setBanner({ type: "error", text: "Failed to update user." });
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleQuickPatch(
    user: AdminUserRow,
    payload: Record<string, unknown>,
    successMsg: string
  ) {
    setBanner(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: "error", text: data.error || "Action failed." });
        return;
      }
      setBanner({ type: "success", text: successMsg });
      await refreshAll();
    } catch {
      setBanner({ type: "error", text: "Network error." });
    }
  }

  async function handleDeleteUser(user: AdminUserRow) {
    if (
      !window.confirm(
        `Delete @${user.username} (${user.display_name}) and all their chat history?`
      )
    ) {
      return;
    }
    setBanner(null);
    try {
      const res = await fetch(
        `/api/admin/users?id=${encodeURIComponent(user.id)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: "error", text: data.error || "Delete failed." });
        return;
      }
      setBanner({ type: "success", text: `Deleted @${user.username}.` });
      await refreshAll();
    } catch {
      setBanner({ type: "error", text: "Failed to delete user." });
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setBanner(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai_provider: settings.ai_provider,
          ai_model: settings.ai_model,
          default_daily_limit: settings.default_daily_limit,
          default_total_limit: settings.default_total_limit,
          custom_instructions: settings.custom_instructions,
          ...(geminiKeyInput.trim()
            ? { gemini_api_key: geminiKeyInput.trim() }
            : {}),
          ...(groqKeyInput.trim() ? { groq_api_key: groqKeyInput.trim() } : {}),
          ...(openrouterKeyInput.trim()
            ? { openrouter_api_key: openrouterKeyInput.trim() }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({
          type: "error",
          text: data.error || "Failed to save AI settings.",
        });
        return;
      }

      setSettings(data.settings);
      setGeminiKeyInput("");
      setGroqKeyInput("");
      setOpenrouterKeyInput("");
      setBanner({
        type: "success",
        text: "Saved AI provider & classroom settings.",
      });
    } catch {
      setBanner({ type: "error", text: "Network error saving settings." });
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading Admin Console...</p>
      </div>
    );
  }

  const students = users.filter((u) => u.role === "student");
  const activeStudents = students.filter((u) => u.is_active).length;
  const totalQuestionsAsked = users.reduce((sum, u) => sum + u.total_used, 0);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="IntechgrityBuddy logo"
            width={36}
            height={36}
            className="w-9 h-9 rounded-xl object-cover shadow-sm"
          />
          <div>
            <h1 className="font-bold text-slate-900 text-base leading-none">
              IntechgrityBuddy Admin Console
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Signed in as <strong>{currentAdminName}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Code2 className="w-4 h-4" />
            Open Student Studio
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <p className="text-xs font-medium text-slate-500">Total Students</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {students.length}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <p className="text-xs font-medium text-slate-500">
              Active Accounts
            </p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {activeStudents}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <p className="text-xs font-medium text-slate-500">
              Total Questions Asked
            </p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">
              {totalQuestionsAsked}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <p className="text-xs font-medium text-slate-500">
              Active Free AI Provider
            </p>
            <p className="text-base font-bold text-slate-900 mt-1 capitalize">
              {settings.ai_provider}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {settings.ai_model}
            </p>
          </div>
        </div>

        {/* Feedback Banner */}
        {banner && (
          <div
            className={`px-4 py-3 rounded-xl border text-sm flex items-center gap-2 ${
              banner.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {banner.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{banner.text}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === "users"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users className="w-4 h-4" />
            Users &amp; Chat Limits
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === "settings"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Settings className="w-4 h-4" />
            AI Provider &amp; Class Settings
          </button>
        </div>

        {activeTab === "users" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Create Account Form */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs h-fit">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                <h2 className="font-bold text-slate-900">Create Account</h2>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. juan.delacruz"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full / Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="e.g. Juan Dela Cruz"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Password
                  </label>
                  <input
                    type="text"
                    required
                    minLength={4}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 4 characters"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Role
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) =>
                      setNewRole(
                        e.target.value === "admin" ? "admin" : "student"
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="student">Student</option>
                    <option value="admin">Admin / Instructor</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Daily Limit
                      </label>
                      <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newDailyUnlimited}
                          onChange={(e) =>
                            setNewDailyUnlimited(e.target.checked)
                          }
                        />
                        ∞
                      </label>
                    </div>
                    <input
                      type="number"
                      min={0}
                      disabled={newDailyUnlimited}
                      value={newDailyLimit}
                      onChange={(e) => setNewDailyLimit(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Total Limit
                      </label>
                      <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newTotalUnlimited}
                          onChange={(e) =>
                            setNewTotalUnlimited(e.target.checked)
                          }
                        />
                        ∞
                      </label>
                    </div>
                    <input
                      type="number"
                      min={0}
                      disabled={newTotalUnlimited}
                      value={newTotalLimit}
                      onChange={(e) => setNewTotalLimit(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm disabled:bg-slate-100"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={creatingUser}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {creatingUser ? "Creating..." : "Create Account"}
                </button>
              </form>
            </div>

            {/* Users Table */}
            <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-900">
                    Classroom Accounts &amp; Usage Limits
                  </h2>
                  <p className="text-xs text-slate-500">
                    Manage daily and total message limits or reset usage anytime.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={refreshAll}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Daily Usage</th>
                      <th className="py-3 px-4">Total Usage</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 flex items-center gap-2">
                            {u.display_name}
                            {u.role === "admin" && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                                ADMIN
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">
                            @{u.username}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              u.is_active
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {u.is_active ? "Active" : "Disabled"}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <UsageBar used={u.daily_used} limit={u.daily_limit} />
                        </td>

                        <td className="py-3 px-4">
                          <UsageBar used={u.total_used} limit={u.total_limit} />
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => openEditModal(u)}
                              title="Edit limits & password"
                              className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-medium text-slate-700 flex items-center gap-1 cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleQuickPatch(
                                  u,
                                  { reset_daily: true },
                                  `Reset daily usage for @${u.username}.`
                                )
                              }
                              title="Reset today's count to 0"
                              className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-indigo-50 text-xs font-medium text-indigo-700 cursor-pointer"
                            >
                              Reset Day
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleQuickPatch(
                                  u,
                                  { reset_total: true },
                                  `Reset total usage for @${u.username}.`
                                )
                              }
                              title="Reset total count to 0"
                              className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-indigo-50 text-xs font-medium text-indigo-700 cursor-pointer"
                            >
                              Reset Total
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleQuickPatch(
                                  u,
                                  { is_active: !u.is_active },
                                  `${u.is_active ? "Disabled" : "Enabled"} @${u.username}.`
                                )
                              }
                              title={
                                u.is_active
                                  ? "Disable account"
                                  : "Enable account"
                              }
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                            >
                              {u.is_active ? (
                                <UserX className="w-3.5 h-3.5 text-amber-600" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              title="Delete account"
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* Settings Tab */
          <form
            onSubmit={handleSaveSettings}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs max-w-3xl space-y-6"
          >
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <Bot className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="font-bold text-slate-900">
                  Free AI Provider &amp; Classroom Settings
                </h2>
                <p className="text-xs text-slate-500">
                  Choose which free AI provider powers IntechgrityBuddy and set
                  default student limits.
                </p>
              </div>
            </div>

            {/* Provider Picker */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Active AI Provider
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(
                  [
                    {
                      id: "gemini",
                      name: "Google Gemini",
                      desc: "Free tier via AI Studio",
                    },
                    {
                      id: "groq",
                      name: "Groq",
                      desc: "Ultra-fast free Llama tier",
                    },
                    {
                      id: "openrouter",
                      name: "OpenRouter",
                      desc: "Access :free community models",
                    },
                  ] as const
                ).map((prov) => (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() =>
                      setSettings((s) => ({
                        ...s,
                        ai_provider: prov.id,
                        ai_model: MODEL_PRESETS[prov.id][0],
                      }))
                    }
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      settings.ai_provider === prov.id
                        ? "border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-semibold text-sm text-slate-900">
                      {prov.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {prov.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Model Name */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Model Name
              </label>
              <input
                type="text"
                value={settings.ai_model}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, ai_model: e.target.value }))
                }
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex flex-wrap gap-1.5">
                {MODEL_PRESETS[settings.ai_provider].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() =>
                      setSettings((s) => ({ ...s, ai_model: preset }))
                    }
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-800 cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* API Keys */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                API Keys (stored in Turso or fallback to .env)
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-700">
                      Gemini API Key
                    </label>
                    <span
                      className={`text-[11px] font-semibold ${
                        settings.has_gemini_key
                          ? "text-emerald-600"
                          : "text-slate-400"
                      }`}
                    >
                      {settings.has_gemini_key ? "Configured ✓" : "Not set"}
                    </span>
                  </div>
                  <input
                    type="password"
                    value={geminiKeyInput}
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    placeholder="Paste new GEMINI_API_KEY (leave blank to keep current)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-700">
                      Groq API Key
                    </label>
                    <span
                      className={`text-[11px] font-semibold ${
                        settings.has_groq_key
                          ? "text-emerald-600"
                          : "text-slate-400"
                      }`}
                    >
                      {settings.has_groq_key ? "Configured ✓" : "Not set"}
                    </span>
                  </div>
                  <input
                    type="password"
                    value={groqKeyInput}
                    onChange={(e) => setGroqKeyInput(e.target.value)}
                    placeholder="Paste new GROQ_API_KEY (leave blank to keep current)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-700">
                      OpenRouter API Key
                    </label>
                    <span
                      className={`text-[11px] font-semibold ${
                        settings.has_openrouter_key
                          ? "text-emerald-600"
                          : "text-slate-400"
                      }`}
                    >
                      {settings.has_openrouter_key ? "Configured ✓" : "Not set"}
                    </span>
                  </div>
                  <input
                    type="password"
                    value={openrouterKeyInput}
                    onChange={(e) => setOpenrouterKeyInput(e.target.value)}
                    placeholder="Paste new OPENROUTER_API_KEY (leave blank to keep current)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Default Limits & Custom Prompt */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Daily Limit (-1 = Unlimited)
                </label>
                <input
                  type="number"
                  min={-1}
                  value={settings.default_daily_limit}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      default_daily_limit: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Total Allowance (-1 = Unlimited)
                </label>
                <input
                  type="number"
                  min={-1}
                  value={settings.default_total_limit}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      default_total_limit: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Classroom Teacher Instructions (added to AI prompt)
              </label>
              <textarea
                rows={3}
                value={settings.custom_instructions}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    custom_instructions: e.target.value,
                  }))
                }
                placeholder="e.g. Remind students to include an About section, 2 project cards, and a footer."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-sm cursor-pointer"
            >
              {savingSettings ? "Saving..." : "Save Settings"}
            </button>
          </form>
        )}
      </main>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">
                Edit @{editingUser.username}
              </h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Daily Limit
                    </label>
                    <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editDailyUnlimited}
                        onChange={(e) =>
                          setEditDailyUnlimited(e.target.checked)
                        }
                      />
                      ∞
                    </label>
                  </div>
                  <input
                    type="number"
                    min={0}
                    disabled={editDailyUnlimited}
                    value={editDailyLimit}
                    onChange={(e) => setEditDailyLimit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Total Limit
                    </label>
                    <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editTotalUnlimited}
                        onChange={(e) =>
                          setEditTotalUnlimited(e.target.checked)
                        }
                      />
                      ∞
                    </label>
                  </div>
                  <input
                    type="number"
                    min={0}
                    disabled={editTotalUnlimited}
                    value={editTotalLimit}
                    onChange={(e) => setEditTotalLimit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reset Password (optional)
                </label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Leave blank to keep existing password"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

