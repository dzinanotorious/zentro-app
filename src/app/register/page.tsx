"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(
        "Успешна регистрација. Провери го твојот email за потврда."
      );
      setEmail("");
      setPassword("");
    }

    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050507] px-4 text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-250px] h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-purple-700/25 blur-[140px]" />
      </div>

      <section className="relative w-full max-w-md rounded-[30px] border border-white/10 bg-[#0b0b10]/90 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/15 text-2xl font-black text-purple-300">
            Z
          </div>

          <h1 className="mt-5 text-3xl font-black">Create account</h1>

          <p className="mt-2 text-sm text-zinc-400">
            Започни го твоето Zentro патување.
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="you@example.com"
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition placeholder:text-zinc-600 focus:border-purple-500/50"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              placeholder="Minimum 6 characters"
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition placeholder:text-zinc-600 focus:border-purple-500/50"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-3 font-bold transition hover:scale-[1.01] disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        {message && (
          <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-zinc-300">
            {message}
          </p>
        )}

        <p className="mt-7 text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <a href="/login" className="font-semibold text-purple-400">
            Sign in
          </a>
        </p>
      </section>
    </main>
  );
}
