"use client";

import { useEffect, useMemo, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { supabase } from "@/lib/supabase";

type WorkoutSession = {
  id: string;
  session_date: string;
  duration_minutes: number | null;
  completed: boolean;
};

type UserStreak = {
  current_streak: number;
  longest_streak: number;
  total_workouts: number;
  total_training_minutes: number;
};

export default function CalendarPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [streak, setStreak] = useState<UserStreak | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const [{ data: workoutData }, { data: streakData }] =
        await Promise.all([
          supabase
            .from("workout_sessions")
            .select(
              "id, session_date, duration_minutes, completed",
            )
            .eq("user_id", user.id)
            .eq("completed", true),

          supabase
            .from("user_streaks")
            .select("*")
            .eq("user_id", user.id)
            .single(),
        ]);

      setSessions((workoutData ?? []) as WorkoutSession[]);
      setStreak(streakData as UserStreak);
    }

    void loadData();
  }, []);

  const selectedDayWorkouts = useMemo(() => {
    const selected = selectedDate.toISOString().slice(0, 10);

    return sessions.filter(
      (session) => session.session_date === selected,
    );
  }, [selectedDate, sessions]);

  const completedDates = useMemo(() => {
    return sessions.map((session) => session.session_date);
  }, [sessions]);

  return (
    <main className="min-h-screen bg-[#050507] px-5 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm font-bold tracking-[0.25em] text-purple-400">
            ZENTRO CALENDAR
          </p>

          <h1 className="mt-3 text-5xl font-black">
            Workout Calendar
          </h1>

          <p className="mt-4 text-zinc-500">
            Track consistency, streaks and completed workouts.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Current streak"
            value={`${streak?.current_streak ?? 0}`}
            subtitle="days"
          />

          <StatCard
            title="Longest streak"
            value={`${streak?.longest_streak ?? 0}`}
            subtitle="days"
          />

          <StatCard
            title="Total workouts"
            value={`${streak?.total_workouts ?? 0}`}
            subtitle="sessions"
          />

          <StatCard
            title="Training time"
            value={`${streak?.total_training_minutes ?? 0}`}
            subtitle="minutes"
          />
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_400px]">
          <div className="rounded-[32px] border border-white/10 bg-[#0b0b10] p-6">
            <Calendar
              onChange={(value) =>
                setSelectedDate(value as Date)
              }
              value={selectedDate}
              tileClassName={({ date }) => {
                const formatted = date
                  .toISOString()
                  .slice(0, 10);

                return completedDates.includes(formatted)
                  ? "workout-day"
                  : "";
              }}
            />
          </div>

          <div className="rounded-[32px] border border-white/10 bg-[#0b0b10] p-6">
            <h2 className="text-2xl font-black">
              Selected day
            </h2>

            <p className="mt-2 text-zinc-500">
              {selectedDate.toDateString()}
            </p>

            <div className="mt-6 space-y-4">
              {selectedDayWorkouts.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-zinc-500">
                  No workouts on this day.
                </div>
              )}

              {selectedDayWorkouts.map((workout) => (
                <div
                  key={workout.id}
                  className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-5"
                >
                  <h3 className="font-bold">
                    Workout completed
                  </h3>

                  <p className="mt-2 text-sm text-zinc-400">
                    Duration:{" "}
                    {workout.duration_minutes ?? 0} min
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className="mt-8 grid gap-5 md:grid-cols-3">
          <AchievementCard
            title="3 Day Streak"
            description="Train 3 days in a row."
          />

          <AchievementCard
            title="10 Workouts"
            description="Complete ten sessions."
          />

          <AchievementCard
            title="Iron Discipline"
            description="Reach a 30-day streak."
          />
        </section>
      </div>

      <style jsx global>{`
        .react-calendar {
          width: 100%;
          background: transparent;
          border: none;
          color: white;
        }

        .react-calendar__tile {
          border-radius: 14px;
          padding: 18px 10px;
        }

        .react-calendar__tile--active {
          background: #7c3aed !important;
        }

        .workout-day {
          background: rgba(124, 58, 237, 0.25) !important;
          border: 1px solid rgba(124, 58, 237, 0.5);
        }
      `}</style>
    </main>
  );
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#0b0b10] p-6">
      <p className="text-zinc-500">{title}</p>

      <h2 className="mt-3 text-4xl font-black">
        {value}
      </h2>

      <p className="mt-2 text-sm text-zinc-600">
        {subtitle}
      </p>
    </div>
  );
}

function AchievementCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[28px] border border-purple-500/20 bg-purple-500/10 p-6">
      <h3 className="text-xl font-black">{title}</h3>

      <p className="mt-3 text-sm text-zinc-400">
        {description}
      </p>
    </div>
  );
}
