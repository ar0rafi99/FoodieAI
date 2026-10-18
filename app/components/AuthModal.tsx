"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-amber-400/60";

export default function AuthModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else if (!data.session)
        setInfo("Account created. Please check your email to confirm, then sign in.");
      else onSuccess();
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else onSuccess();
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-7 shadow-2xl">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-amber-300">
              {mode === "signin" ? "Welcome back" : "Create account"}
            </h2>
            <p className="mt-1 text-sm text-neutral-400">
              {mode === "signin" ? "Sign in to place your order" : "Join us to start ordering"}
            </p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-neutral-500 hover:text-white">
            ×
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}
          {info && <p className="text-sm text-emerald-400">{info}</p>}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-amber-400 py-3 font-semibold text-black transition hover:bg-amber-300 disabled:opacity-60"
          >
            {loading ? "Please wait..." : mode === "signin" ? "Sign In" : "Sign Up"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-neutral-400">
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
              setInfo("");
            }}
            className="font-medium text-amber-300 hover:underline"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}