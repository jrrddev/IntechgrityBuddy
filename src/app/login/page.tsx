"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Lock, Sparkles, User } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed. Please check your credentials.");
        setLoading(false);
        return;
      }

      if (data.user?.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/");
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-7 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Image
              src="/logo.png"
              alt="IntechgrityBuddy logo"
              width={48}
              height={48}
              className="w-12 h-12 rounded-xl object-cover shadow-md border border-white/20"
            />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                IntechgrityBuddy
              </h1>
              <p className="text-indigo-100 text-sm">
                HTML &amp; CSS Portfolio AI Tutor
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Sign in to your classroom workspace
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Use the username and password provided by your instructor.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. alex.rivera"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 text-center">
            Need an account? Ask your class instructor or admin to create one
            for you.
          </div>
        </form>
      </div>
    </div>
  );
}

