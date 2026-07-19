"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage(
        "Успешна регистрација. Провери го твојот email за потврда."
      );

      setEmail("");
      setPassword("");
    } catch {
      setMessage(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#050507] px-4 py-6 text-white sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-64 max-w-2xl bg-gradient-to-b from-purple-600/15 to-transparent"
      />

      <section className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0b10] p-5 shadow-xl sm:p-8">
        <div className="mb-7 text-center sm:mb-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-400/20 bg-purple-500/10 text-xl font-black text-purple-300 sm:h-14 sm:w-14 sm:text-2xl">
            Z
          </div>

          <h1 className="mt-4 text-2xl font-black tracking-tight sm:mt-5 sm:text-3xl">
            Create account
          </h1>

          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Започни го твоето Zentro патување.
          </p>
        </div>

        <form
          onSubmit={handleRegister}
          className="space-y-4 sm:space-y-5"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Email
            </label>

            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              required
              disabled={loading}
              placeholder="you@example.com"
              className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-base text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              required
              minLength={6}
              disabled={loading}
              placeholder="Minimum 6 characters"
              className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-base text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          {message && (
            <div
              className={`rounded-2xl px-4 py-3 text-sm leading-5 ${
                message.includes("Успешна")
                  ? "border border-green-500/20 bg-green-500/10 text-green-300"
                  : "border border-red-500/20 bg-red-500/10 text-red-200"
              }`}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 text-sm font-bold shadow-lg shadow-purple-950/20 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
          >
            {loading
              ? "Creating account..."
              : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm leading-6 text-zinc-500 sm:mt-7">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-purple-400 transition hover:text-purple-300"
          >
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
