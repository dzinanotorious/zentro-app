"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Exercise = {
  id: string;
  name: string;
  muscle_group: string;
};

type WorkoutSet = {
  id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  completed: boolean;
  exercise: Exercise;
};

type WorkoutDay = {
  id: string;
  name: string;
  focus: string | null;
};

type WorkoutSession = {
  id: string;
  session_date: string;
  started_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
  completed: boolean;
  notes: string | null;
  workout_day: WorkoutDay | null;
  workout_sets: WorkoutSet[];
};

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  return remaining > 0
    ? `${hours}h ${remaining}m`
    : `${hours}h`;
}

export default function WorkoutSummaryPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadSummary() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("workout_sessions")
        .select(`
          id,
          session_date,
          started_at,
          completed_at,
          duration_minutes,
          completed,
          notes,
          workout_day:workout_days (
            id,
            name,
            focus
          ),
          workout_sets (
            id,
            set_number,
            weight_kg,
            reps,
            rpe,
            completed,
            exercise:exercises (
              id,
              name,
              muscle_group
            )
          )
        `)
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setMessage("Workout summary not found.");
        setLoading(false);
        return;
      }

      const parsed = data as unknown as WorkoutSession;

      setSession(parsed);
      setNotes(parsed.notes ?? "");
      setLoading(false);
    }

    void loadSummary();
  }, [id, router]);

  const completedSets = useMemo(
    () =>
      session?.workout_sets.filter((set) => set.completed) ?? [],
    [session],
  );

  const totalVolume = useMemo(() => {
    return completedSets.reduce((total, set) => {
      return (
        total +
        Number(set.weight_kg ?? 0) *
          Number(set.reps ?? 0)
      );
    }, 0);
  }, [completedSets]);

  const averageRpe = useMemo(() => {
    const validSets = completedSets.filter(
      (set) => set.rpe !== null,
    );

    if (validSets.length === 0) return 0;

    return (
      validSets.reduce(
        (total, set) => total + Number(set.rpe),
        0,
      ) / validSets.length
    );
  }, [completedSets]);

  const exerciseGroups = useMemo(() => {
    const groups = new Map<string, WorkoutSet[]>();

    completedSets.forEach((set) => {
      const key = set.exercise.id;
      const current = groups.get(key) ?? [];

      groups.set(key, [...current, set]);
    });

    return Array.from(groups.entries()).map(
      ([exerciseId, sets]) => ({
        exerciseId,
        exercise: sets[0].exercise,
        sets: [...sets].sort(
          (a, b) => a.set_number - b.set_number,
        ),
      }),
    );
  }, [completedSets]);

  async function saveReview() {
    setSaving(true);
    setMessage("");

    const reviewText =
      rating > 0
        ? `[Workout rating: ${rating}/5]\n${notes}`.trim()
        : notes.trim();

    const { error } = await supabase
      .from("workout_sessions")
      .update({
        notes: reviewText || null,
      })
      .eq("id", id);

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setMessage("Workout review saved.");
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          <p className="mt-5 text-sm text-zinc-400">
            Building workout summary...
          </p>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050507] px-5 text-white">
        <section className="w-full max-w-lg rounded-[32px] border border-red-500/20 bg-red-500/[0.05] p-8 text-center">
          <h1 className="text-3xl font-black">
            Summary unavailable
          </h1>

          <p className="mt-3 text-zinc-500">
            {message}
          </p>

          <Link
            href="/programs"
            className="mt-7 inline-block rounded-2xl bg-purple-600 px-6 py-3 font-bold"
          >
            Back to programs
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[10%] top-[-350px] h-[750px] w-[750px] rounded-full bg-emerald-700/10 blur-[180px]" />
        <div className="absolute -right-80 top-[35%] h-[700px] w-[700px] rounded-full bg-purple-900/15 blur-[180px]" />
      </div>

      <div className="relative mx-auto max-w-[1450px] px-5 py-8 sm:px-8 lg:px-10">
        <header className="rounded-[38px] border border-emerald-500/20 bg-gradient-to-br from-emerald-600/15 via-emerald-950/10 to-transparent p-7 sm:p-10">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
            <div>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-[10px] font-bold tracking-[0.15em] text-emerald-300">
                WORKOUT COMPLETED
              </span>

              <h1 className="mt-6 text-4xl font-black sm:text-6xl">
                Strong work.
              </h1>

              <p className="mt-4 text-lg text-zinc-400">
                {session.workout_day?.name ?? "Workout session"}
              </p>

              <p className="mt-2 text-sm text-zinc-600">
                {formatDate(session.session_date)}
              </p>
            </div>

            <div className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-emerald-500/20 bg-emerald-500/10 text-4xl text-emerald-300">
              ✓
            </div>
          </div>
        </header>

        {message && (
          <div className="mt-6 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-4 text-sm text-purple-100">
            {message}
          </div>
        )}

        <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Duration"
            value={formatDuration(
              session.duration_minutes ?? 0,
            )}
            description="Total workout time"
          />

          <StatCard
            label="Completed sets"
            value={`${completedSets.length}`}
            description="Successfully logged sets"
          />

          <StatCard
            label="Training volume"
            value={`${Math.round(totalVolume).toLocaleString()} kg`}
            description="Weight × repetitions"
          />

          <StatCard
            label="Average RPE"
            value={
              averageRpe > 0
                ? averageRpe.toFixed(1)
                : "—"
            }
            description="Average workout intensity"
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-6 sm:p-8">
            <p className="text-sm text-zinc-500">
              Workout performance
            </p>

            <h2 className="mt-2 text-3xl font-black">
              Exercise breakdown
            </h2>

            <div className="mt-8 space-y-5">
              {exerciseGroups.map((group) => {
                const exerciseVolume = group.sets.reduce(
                  (total, set) =>
                    total +
                    Number(set.weight_kg ?? 0) *
                      Number(set.reps ?? 0),
                  0,
                );

                const maxWeight = Math.max(
                  ...group.sets.map((set) =>
                    Number(set.weight_kg ?? 0),
                  ),
                );

                return (
                  <article
                    key={group.exerciseId}
                    className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5"
                  >
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-purple-400">
                          {group.exercise.muscle_group}
                        </p>

                        <h3 className="mt-2 text-xl font-black">
                          {group.exercise.name}
                        </h3>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:w-[240px]">
                        <MiniStat
                          label="Volume"
                          value={`${Math.round(
                            exerciseVolume,
                          ).toLocaleString()} kg`}
                        />

                        <MiniStat
                          label="Best weight"
                          value={`${maxWeight} kg`}
                        />
                      </div>
                    </div>

                    <div className="mt-5 overflow-x-auto">
                      <div className="min-w-[500px] space-y-2">
                        {group.sets.map((set) => (
                          <div
                            key={set.id}
                            className="grid grid-cols-4 gap-3 rounded-xl border border-white/[0.05] bg-black/20 p-3 text-sm"
                          >
                            <span className="text-zinc-600">
                              Set {set.set_number}
                            </span>

                            <span className="font-bold">
                              {set.weight_kg ?? 0} kg
                            </span>

                            <span className="font-bold">
                              {set.reps ?? 0} reps
                            </span>

                            <span className="font-bold text-purple-300">
                              RPE {set.rpe ?? "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}

              {exerciseGroups.length === 0 && (
                <div className="rounded-3xl border border-dashed border-white/[0.08] p-10 text-center">
                  <p className="text-zinc-500">
                    No completed sets were recorded.
                  </p>
                </div>
              )}
            </div>
          </article>

          <aside className="space-y-6">
            <article className="rounded-[34px] border border-purple-500/15 bg-gradient-to-br from-purple-600/15 to-transparent p-7">
              <p className="text-sm text-purple-300">
                Rate your workout
              </p>

              <h2 className="mt-2 text-2xl font-black">
                How did it feel?
              </h2>

              <div className="mt-6 grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className={`h-12 rounded-xl border text-lg transition ${
                      rating >= value
                        ? "border-purple-500/35 bg-purple-500/20 text-purple-200"
                        : "border-white/[0.07] bg-white/[0.025] text-zinc-700"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>

              <label className="mb-2 mt-7 block text-sm text-zinc-400">
                Workout notes
              </label>

              <textarea
                rows={6}
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                placeholder="How did the workout feel? Any pain, PRs or exercises to adjust?"
                className="w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none placeholder:text-zinc-700 focus:border-purple-500/50"
              />

              <button
                type="button"
                disabled={saving}
                onClick={() => void saveReview()}
                className="mt-5 w-full rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-4 font-bold disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save workout review"}
              </button>
            </article>

            <article className="rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-7">
              <h2 className="text-xl font-black">
                Continue your journey
              </h2>

              <div className="mt-5 space-y-3">
                <Link
                  href="/programs"
                  className="block rounded-2xl bg-purple-600 px-5 py-4 text-center text-sm font-bold"
                >
                  Next workout
                </Link>

                <Link
                  href="/dashboard"
                  className="block rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-4 text-center text-sm font-bold text-zinc-300"
                >
                  Dashboard
                </Link>

                <Link
                  href="/progress"
                  className="block rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-4 text-center text-sm font-bold text-zinc-300"
                >
                  View progress
                </Link>
              </div>
            </article>
          </aside>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <article className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-3 text-3xl font-black">{value}</p>
      <p className="mt-2 text-xs text-zinc-600">
        {description}
      </p>
    </article>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3">
      <p className="text-[10px] text-zinc-600">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-zinc-300">
        {value}
      </p>
    </div>
  );
}
