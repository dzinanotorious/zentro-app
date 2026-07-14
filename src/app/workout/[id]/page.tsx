"use client";

import Link from "next/link";
import {
  FormEvent,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Exercise = {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string;
};

type WorkoutExercise = {
  id: string;
  exercise_order: number;
  sets: number;
  reps_min: number | null;
  reps_max: number | null;
  rest_seconds: number;
  notes: string | null;
  exercise: Exercise;
};

type WorkoutDay = {
  id: string;
  name: string;
  focus: string | null;
  workout_exercises: WorkoutExercise[];
};

type WorkoutSession = {
  id: string;
  user_id: string;
  session_date: string;
  started_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
  completed: boolean;
  notes: string | null;
  workout_day: WorkoutDay | null;
};

type WorkoutSet = {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  completed: boolean;
};

type SetInput = {
  id?: string;
  exerciseId: string;
  setNumber: number;
  weight: string;
  reps: string;
  rpe: string;
  completed: boolean;
};

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0",
    )}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}`;
}

function formatRest(seconds: number) {
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  return remaining === 0
    ? `${minutes}m`
    : `${minutes}m ${remaining}s`;
}

export default function ActiveWorkoutPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [sets, setSets] = useState<SetInput[]>([]);
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(
    null,
  );

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restSeconds, setRestSeconds] = useState(0);
  const [restRunning, setRestRunning] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingSetKey, setSavingSetKey] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error"
  >("success");

  const loadWorkout = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const [
      { data: sessionData, error: sessionError },
      { data: existingSets, error: setsError },
    ] = await Promise.all([
      supabase
        .from("workout_sessions")
        .select(`
          id,
          user_id,
          session_date,
          started_at,
          completed_at,
          duration_minutes,
          completed,
          notes,
          workout_day:workout_days (
            id,
            name,
            focus,
            workout_exercises (
              id,
              exercise_order,
              sets,
              reps_min,
              reps_max,
              rest_seconds,
              notes,
              exercise:exercises (
                id,
                name,
                muscle_group,
                equipment
              )
            )
          )
        `)
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle(),

      supabase
        .from("workout_sets")
        .select("*")
        .eq("session_id", id)
        .order("set_number", {
          ascending: true,
        }),
    ]);

    if (sessionError) {
      setMessageType("error");
      setMessage(sessionError.message);
      setLoading(false);
      return;
    }

    if (setsError) {
      setMessageType("error");
      setMessage(setsError.message);
      setLoading(false);
      return;
    }

    if (!sessionData) {
      setMessageType("error");
      setMessage("Workout session not found.");
      setLoading(false);
      return;
    }

    const parsed = sessionData as unknown as WorkoutSession;

    if (parsed.workout_day) {
      parsed.workout_day.workout_exercises = [
        ...parsed.workout_day.workout_exercises,
      ].sort((a, b) => a.exercise_order - b.exercise_order);
    }

    setSession(parsed);

    const savedSets = (existingSets ?? []) as WorkoutSet[];

    const generatedSets: SetInput[] = [];

    parsed.workout_day?.workout_exercises.forEach((item) => {
      for (let setNumber = 1; setNumber <= item.sets; setNumber++) {
        const existing = savedSets.find(
          (set) =>
            set.exercise_id === item.exercise.id &&
            set.set_number === setNumber,
        );

        generatedSets.push({
          id: existing?.id,
          exerciseId: item.exercise.id,
          setNumber,
          weight:
            existing?.weight_kg !== null &&
            existing?.weight_kg !== undefined
              ? String(existing.weight_kg)
              : "",
          reps:
            existing?.reps !== null && existing?.reps !== undefined
              ? String(existing.reps)
              : "",
          rpe:
            existing?.rpe !== null && existing?.rpe !== undefined
              ? String(existing.rpe)
              : "",
          completed: existing?.completed ?? false,
        });
      }
    });

    setSets(generatedSets);

    const firstExercise =
      parsed.workout_day?.workout_exercises[0]?.exercise.id ?? null;

    setActiveExerciseId(firstExercise);

    if (parsed.started_at) {
      const started = new Date(parsed.started_at).getTime();
      const now = Date.now();

      setElapsedSeconds(Math.max(0, Math.floor((now - started) / 1000)));
    }

    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    void loadWorkout();
  }, [loadWorkout]);

  useEffect(() => {
    if (!session || session.completed) return;

    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!restRunning || restSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setRestSeconds((current) => {
        if (current <= 1) {
          setRestRunning(false);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [restRunning, restSeconds]);

  const exercises = session?.workout_day?.workout_exercises ?? [];

  const totalSets = sets.length;
  const completedSets = sets.filter((set) => set.completed).length;

  const workoutVolume = useMemo(() => {
    return sets.reduce((total, set) => {
      if (!set.completed) return total;

      const weight = Number(set.weight || 0);
      const reps = Number(set.reps || 0);

      return total + weight * reps;
    }, 0);
  }, [sets]);

  const completionPercentage =
    totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

  function updateSet(
    exerciseId: string,
    setNumber: number,
    field: "weight" | "reps" | "rpe",
    value: string,
  ) {
    setSets((current) =>
      current.map((set) =>
        set.exerciseId === exerciseId && set.setNumber === setNumber
          ? {
              ...set,
              [field]: value,
            }
          : set,
      ),
    );
  }

  async function toggleSet(
    exercise: WorkoutExercise,
    setInput: SetInput,
  ) {
    setSavingSetKey(`${setInput.exerciseId}-${setInput.setNumber}`);
    setMessage("");

    const completed = !setInput.completed;

    const weight =
      setInput.weight.trim() === "" ? null : Number(setInput.weight);

    const reps =
      setInput.reps.trim() === "" ? null : Number(setInput.reps);

    const rpe = setInput.rpe.trim() === "" ? null : Number(setInput.rpe);

    if (weight !== null && (!Number.isFinite(weight) || weight < 0)) {
      setMessageType("error");
      setMessage("Enter a valid weight.");
      setSavingSetKey(null);
      return;
    }

    if (reps !== null && (!Number.isFinite(reps) || reps < 0)) {
      setMessageType("error");
      setMessage("Enter valid repetitions.");
      setSavingSetKey(null);
      return;
    }

    if (
      rpe !== null &&
      (!Number.isFinite(rpe) || rpe < 1 || rpe > 10)
    ) {
      setMessageType("error");
      setMessage("RPE must be between 1 and 10.");
      setSavingSetKey(null);
      return;
    }

    const payload = {
      session_id: id,
      exercise_id: exercise.exercise.id,
      set_number: setInput.setNumber,
      weight_kg: weight,
      reps,
      rpe,
      completed,
    };

    let savedId = setInput.id;

    if (setInput.id) {
      const { error } = await supabase
        .from("workout_sets")
        .update(payload)
        .eq("id", setInput.id);

      if (error) {
        setMessageType("error");
        setMessage(error.message);
        setSavingSetKey(null);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("workout_sets")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        setMessageType("error");
        setMessage(error.message);
        setSavingSetKey(null);
        return;
      }

      savedId = data.id;
    }

    setSets((current) =>
      current.map((set) =>
        set.exerciseId === setInput.exerciseId &&
        set.setNumber === setInput.setNumber
          ? {
              ...set,
              id: savedId,
              completed,
            }
          : set,
      ),
    );

    if (completed) {
      setRestSeconds(exercise.rest_seconds);
      setRestRunning(true);

      await updatePersonalRecord(
        exercise.exercise.id,
        weight,
        reps,
      );
    }

    setMessageType("success");
    setMessage(
      completed
        ? `${exercise.exercise.name} set ${setInput.setNumber} completed.`
        : `${exercise.exercise.name} set ${setInput.setNumber} reopened.`,
    );

    setSavingSetKey(null);
  }

  async function updatePersonalRecord(
    exerciseId: string,
    weight: number | null,
    reps: number | null,
  ) {
    if (!weight || !reps) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const estimatedOneRepMax =
      reps > 0 ? weight * (1 + reps / 30) : weight;

    const { data: existing } = await supabase
      .from("personal_records")
      .select("id, estimated_one_rep_max")
      .eq("user_id", user.id)
      .eq("exercise_id", exerciseId)
      .maybeSingle();

    if (
      existing &&
      Number(existing.estimated_one_rep_max ?? 0) >= estimatedOneRepMax
    ) {
      return;
    }

    await supabase.from("personal_records").upsert(
      {
        user_id: user.id,
        exercise_id: exerciseId,
        weight_kg: weight,
        reps,
        estimated_one_rep_max: estimatedOneRepMax,
        achieved_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,exercise_id",
      },
    );
  }

  async function finishWorkout(event?: FormEvent) {
    event?.preventDefault();
  
    const confirmed = window.confirm(
      `Finish workout with ${completedSets} of ${totalSets} completed sets?`,
    );
  
    if (!confirmed) return;
  
    setFinishing(true);
    setMessage("");
  
    const durationMinutes = Math.max(
      1,
      Math.round(elapsedSeconds / 60),
    );
  
    const { error } = await supabase
      .from("workout_sessions")
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
        duration_minutes: durationMinutes,
      })
      .eq("id", id);
  
    if (error) {
      setMessageType("error");
      setMessage(error.message);
      setFinishing(false);
      return;
    }
  
    const { error: streakError } = await supabase.rpc(
      "refresh_user_streak",
    );
  
    if (streakError) {
      console.error("Streak update failed:", streakError);
    }
    const { error: rewardError } = await supabase.rpc(
        "update_user_rewards",
      );
      
      if (rewardError) {
        console.error("Reward update failed:", rewardError);
      }
    router.push(`/workout/${id}/summary`);
  }
  
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          <p className="mt-5 text-sm text-zinc-400">
            Preparing your workout...
          </p>
        </div>
      </main>
    );
  }

  if (!session || !session.workout_day) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050507] px-5 text-white">
        <section className="w-full max-w-lg rounded-[32px] border border-red-500/20 bg-red-500/[0.05] p-8 text-center">
          <h1 className="text-3xl font-black">
            Workout unavailable
          </h1>

          <p className="mt-3 text-zinc-500">
            {message || "This workout session could not be loaded."}
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
        <div className="absolute left-[10%] top-[-350px] h-[750px] w-[750px] rounded-full bg-purple-700/20 blur-[180px]" />
        <div className="absolute -right-80 top-[35%] h-[700px] w-[700px] rounded-full bg-fuchsia-900/10 blur-[180px]" />
      </div>

      <div className="relative mx-auto max-w-[1550px] px-5 py-7 sm:px-8 lg:px-10">
        <header className="flex flex-col justify-between gap-6 border-b border-white/[0.06] pb-8 lg:flex-row lg:items-center">
          <div>
            <Link
              href="/programs"
              className="text-sm font-bold text-zinc-500 transition hover:text-purple-300"
            >
              ← Exit workout
            </Link>

            <p className="mt-5 text-xs font-bold tracking-[0.22em] text-purple-400">
              ACTIVE WORKOUT
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              {session.workout_day.name}
            </h1>

            <p className="mt-3 max-w-2xl leading-7 text-zinc-500">
              {session.workout_day.focus}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void finishWorkout()}
            disabled={finishing}
            className="rounded-2xl bg-gradient-to-r from-emerald-600 to-green-500 px-7 py-4 text-sm font-black shadow-[0_0_35px_rgba(16,185,129,0.18)] disabled:opacity-50"
          >
            {finishing ? "Finishing..." : "Finish workout"}
          </button>
        </header>

        {message && (
          <div
            className={`mt-6 rounded-2xl border p-4 text-sm ${
              messageType === "error"
                ? "border-red-500/20 bg-red-500/10 text-red-200"
                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {message}
          </div>
        )}

        <section className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Workout time"
            value={formatDuration(elapsedSeconds)}
            description="Live session duration"
          />

          <StatCard
            label="Set completion"
            value={`${completedSets}/${totalSets}`}
            description={`${completionPercentage}% completed`}
          />

          <StatCard
            label="Training volume"
            value={`${Math.round(workoutVolume).toLocaleString()} kg`}
            description="Completed weight × reps"
          />

          <StatCard
            label="Exercises"
            value={`${exercises.length}`}
            description="Planned movements"
          />
        </section>

        {restSeconds > 0 && (
          <section className="mt-6 rounded-[32px] border border-purple-500/20 bg-gradient-to-r from-purple-600/15 to-violet-500/5 p-6">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-bold text-purple-300">
                  Rest timer
                </p>

                <p className="mt-2 text-4xl font-black">
                  {formatDuration(restSeconds)}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRestRunning((current) => !current)}
                  className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold"
                >
                  {restRunning ? "Pause" : "Resume"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRestSeconds(0);
                    setRestRunning(false);
                  }}
                  className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-bold"
                >
                  Skip rest
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.32fr_0.68fr]">
          <aside className="space-y-3">
            {exercises.map((item) => {
              const exerciseSets = sets.filter(
                (set) => set.exerciseId === item.exercise.id,
              );

              const completed = exerciseSets.filter(
                (set) => set.completed,
              ).length;

              const active = activeExerciseId === item.exercise.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveExerciseId(item.exercise.id)}
                  className={`w-full rounded-3xl border p-5 text-left transition ${
                    active
                      ? "border-purple-500/35 bg-purple-500/12"
                      : "border-white/[0.07] bg-white/[0.025] hover:border-purple-500/25"
                  }`}
                >
                  <p className="text-xs font-bold text-purple-400">
                    EXERCISE {item.exercise_order}
                  </p>

                  <h2 className="mt-2 text-lg font-black">
                    {item.exercise.name}
                  </h2>

                  <p className="mt-1 text-xs text-zinc-600">
                    {item.exercise.muscle_group} · {item.exercise.equipment}
                  </p>

                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="text-zinc-600">
                      {completed}/{item.sets} sets
                    </span>

                    <span className="text-purple-300">
                      {completionPercentage > 0 ? "In progress" : "Ready"}
                    </span>
                  </div>
                </button>
              );
            })}
          </aside>

          <div className="space-y-6">
            {exercises
              .filter(
                (item) => item.exercise.id === activeExerciseId,
              )
              .map((exercise) => {
                const exerciseSets = sets.filter(
                  (set) => set.exerciseId === exercise.exercise.id,
                );

                return (
                  <article
                    key={exercise.id}
                    className="rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-6 sm:p-8"
                  >
                    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                      <div>
                        <p className="text-xs font-bold tracking-[0.18em] text-purple-400">
                          {exercise.exercise.muscle_group.toUpperCase()}
                        </p>

                        <h2 className="mt-3 text-3xl font-black">
                          {exercise.exercise.name}
                        </h2>

                        <p className="mt-2 text-sm text-zinc-600">
                          {exercise.exercise.equipment} ·{" "}
                          {exercise.sets} sets ·{" "}
                          {exercise.reps_min ?? "—"}–
                          {exercise.reps_max ?? "—"} reps
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-3 text-sm">
                        Rest:{" "}
                        <strong>
                          {formatRest(exercise.rest_seconds)}
                        </strong>
                      </div>
                    </div>

                    {exercise.notes && (
                      <div className="mt-6 rounded-2xl border border-purple-500/10 bg-purple-500/[0.05] p-4 text-sm leading-6 text-zinc-400">
                        {exercise.notes}
                      </div>
                    )}

                    <div className="mt-7 overflow-x-auto">
                      <div className="min-w-[680px]">
                        <div className="grid grid-cols-[80px_1fr_1fr_1fr_140px] gap-3 px-3 text-xs font-bold text-zinc-600">
                          <span>SET</span>
                          <span>WEIGHT KG</span>
                          <span>REPS</span>
                          <span>RPE</span>
                          <span>STATUS</span>
                        </div>

                        <div className="mt-3 space-y-3">
                          {exerciseSets.map((setInput) => {
                            const saving =
                              savingSetKey ===
                              `${setInput.exerciseId}-${setInput.setNumber}`;

                            return (
                              <div
                                key={`${setInput.exerciseId}-${setInput.setNumber}`}
                                className={`grid grid-cols-[80px_1fr_1fr_1fr_140px] gap-3 rounded-2xl border p-3 ${
                                  setInput.completed
                                    ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                                    : "border-white/[0.06] bg-white/[0.025]"
                                }`}
                              >
                                <div className="flex items-center justify-center rounded-xl bg-black/20 font-black">
                                  {setInput.setNumber}
                                </div>

                                <SetInputField
                                  value={setInput.weight}
                                  placeholder="0"
                                  onChange={(value) =>
                                    updateSet(
                                      setInput.exerciseId,
                                      setInput.setNumber,
                                      "weight",
                                      value,
                                    )
                                  }
                                />

                                <SetInputField
                                  value={setInput.reps}
                                  placeholder={
                                    exercise.reps_min
                                      ? String(exercise.reps_min)
                                      : "0"
                                  }
                                  onChange={(value) =>
                                    updateSet(
                                      setInput.exerciseId,
                                      setInput.setNumber,
                                      "reps",
                                      value,
                                    )
                                  }
                                />

                                <SetInputField
                                  value={setInput.rpe}
                                  placeholder="8"
                                  onChange={(value) =>
                                    updateSet(
                                      setInput.exerciseId,
                                      setInput.setNumber,
                                      "rpe",
                                      value,
                                    )
                                  }
                                />

                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() =>
                                    void toggleSet(exercise, setInput)
                                  }
                                  className={`rounded-xl px-4 py-3 text-xs font-bold transition disabled:opacity-50 ${
                                    setInput.completed
                                      ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                                      : "bg-purple-600 text-white"
                                  }`}
                                >
                                  {saving
                                    ? "Saving..."
                                    : setInput.completed
                                      ? "Completed ✓"
                                      : "Complete"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}

            <article className="rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-7">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm text-zinc-500">
                    Workout completion
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    {completionPercentage}% completed
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => void finishWorkout()}
                  disabled={finishing}
                  className="rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black disabled:opacity-50"
                >
                  Finish workout
                </button>
              </div>

              <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-600 to-emerald-400 transition-all duration-500"
                  style={{
                    width: `${completionPercentage}%`,
                  }}
                />
              </div>
            </article>
          </div>
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

      <p className="mt-2 text-xs text-zinc-600">{description}</p>
    </article>
  );
}

function SetInputField({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="number"
      min="0"
      step="0.5"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="min-w-0 rounded-xl border border-white/[0.07] bg-black/30 px-4 py-3 font-bold outline-none placeholder:text-zinc-800 focus:border-purple-500/40"
    />
  );
}
