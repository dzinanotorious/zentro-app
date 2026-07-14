"use client";

import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabase";

type Profile = {
  full_name: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal: string | null;
};

type ProgressEntry = {
  id: string;
  user_id: string;
  entry_date: string;
  weight: number | null;
  body_fat: number | null;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  arms: number | null;
  thighs: number | null;
  neck: number | null;
  notes: string | null;
  front_photo: string | null;
  side_photo: string | null;
  back_photo: string | null;
  created_at: string;
};

type PhotoType = "front" | "side" | "back";

type PhotoUrls = {
  front: string | null;
  side: string | null;
  back: string | null;
};

type FormState = {
  entryDate: string;
  weight: string;
  bodyFat: string;
  chest: string;
  waist: string;
  hips: string;
  arms: string;
  thighs: string;
  neck: string;
  notes: string;
};

const emptyForm: FormState = {
  entryDate: getDateString(new Date()),
  weight: "",
  bodyFat: "",
  chest: "",
  waist: "",
  hips: "",
  arms: "",
  thighs: "",
  neck: "",
  notes: "",
};

function getDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T12:00:00`));
}

function numberOrNull(value: string) {
  const number = Number(value);

  return value.trim() && Number.isFinite(number) ? number : null;
}

function getGoalLabel(goal?: string | null) {
  if (goal === "gain") return "Muscle Gain";
  if (goal === "lose") return "Fat Loss";

  return "Balanced Fitness";
}

export default function ProgressPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  const [photoUrls, setPhotoUrls] = useState<PhotoUrls>({
    front: null,
    side: null,
    back: null,
  });

  const [form, setForm] = useState<FormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(
    null,
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] =
    useState<PhotoType | null>(null);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error"
  >("success");

  const loadProgress = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/login");
      return;
    }

    setUserId(user.id);

    const [
      { data: profileData, error: profileError },
      { data: progressData, error: progressError },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, height_cm, weight_kg, goal")
        .eq("id", user.id)
        .maybeSingle(),

      supabase
        .from("progress_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("entry_date", {
          ascending: true,
        }),
    ]);

    if (profileError) {
      setMessageType("error");
      setMessage(profileError.message);
      setLoading(false);
      return;
    }

    if (progressError) {
      setMessageType("error");
      setMessage(progressError.message);
      setLoading(false);
      return;
    }

    const loadedEntries = (progressData ?? []) as ProgressEntry[];

    setProfile(profileData as Profile | null);
    setEntries(loadedEntries);

    const latestEntry = loadedEntries.at(-1);

    if (latestEntry) {
      await loadSignedPhotos(latestEntry);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  async function loadSignedPhotos(entry: ProgressEntry) {
    const paths = {
      front: entry.front_photo,
      side: entry.side_photo,
      back: entry.back_photo,
    };

    const result: PhotoUrls = {
      front: null,
      side: null,
      back: null,
    };

    for (const type of ["front", "side", "back"] as PhotoType[]) {
      const path = paths[type];

      if (!path) continue;

      const { data, error } = await supabase.storage
        .from("progress-photos")
        .createSignedUrl(path, 3600);

      if (!error) {
        result[type] = data.signedUrl;
      }
    }

    setPhotoUrls(result);
  }

  const latestEntry = entries.at(-1) ?? null;
  const firstEntry = entries[0] ?? null;
  const previousEntry =
    entries.length > 1 ? entries[entries.length - 2] : null;

  const currentWeight =
    latestEntry?.weight ?? profile?.weight_kg ?? 0;

  const weightChange =
    latestEntry?.weight && firstEntry?.weight
      ? latestEntry.weight - firstEntry.weight
      : 0;

  const weeklyChange =
    latestEntry?.weight && previousEntry?.weight
      ? latestEntry.weight - previousEntry.weight
      : 0;

  const bmi = useMemo(() => {
    const height = Number(profile?.height_cm ?? 0);
    const weight = Number(currentWeight);

    if (!height || !weight) return 0;

    return weight / Math.pow(height / 100, 2);
  }, [currentWeight, profile?.height_cm]);

  const chartData = useMemo(
    () =>
      entries
        .filter((entry) => entry.weight)
        .map((entry) => ({
          date: shortDate(entry.entry_date),
          weight: Number(entry.weight),
          waist: Number(entry.waist ?? 0),
          bodyFat: Number(entry.body_fat ?? 0),
        })),
    [entries],
  );

  function updateField(
    field: keyof FormState,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openNewEntry() {
    setEditingEntryId(null);

    setForm({
      ...emptyForm,
      entryDate: getDateString(new Date()),
      weight: currentWeight ? String(currentWeight) : "",
    });

    setMessage("");
    setShowForm(true);
  }

  function openEditEntry(entry: ProgressEntry) {
    setEditingEntryId(entry.id);

    setForm({
      entryDate: entry.entry_date,
      weight: entry.weight ? String(entry.weight) : "",
      bodyFat: entry.body_fat ? String(entry.body_fat) : "",
      chest: entry.chest ? String(entry.chest) : "",
      waist: entry.waist ? String(entry.waist) : "",
      hips: entry.hips ? String(entry.hips) : "",
      arms: entry.arms ? String(entry.arms) : "",
      thighs: entry.thighs ? String(entry.thighs) : "",
      neck: entry.neck ? String(entry.neck) : "",
      notes: entry.notes ?? "",
    });

    setMessage("");
    setShowForm(true);
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) return;

    if (!form.weight || Number(form.weight) <= 0) {
      setMessageType("error");
      setMessage("Внеси валидна тежина.");
      return;
    }

    setSaving(true);
    setMessage("");

    const payload = {
      user_id: userId,
      entry_date: form.entryDate,
      weight: numberOrNull(form.weight),
      body_fat: numberOrNull(form.bodyFat),
      chest: numberOrNull(form.chest),
      waist: numberOrNull(form.waist),
      hips: numberOrNull(form.hips),
      arms: numberOrNull(form.arms),
      thighs: numberOrNull(form.thighs),
      neck: numberOrNull(form.neck),
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let error;

    if (editingEntryId) {
      const result = await supabase
        .from("progress_entries")
        .update(payload)
        .eq("id", editingEntryId)
        .eq("user_id", userId);

      error = result.error;
    } else {
      const result = await supabase
        .from("progress_entries")
        .upsert(payload, {
          onConflict: "user_id,entry_date",
        });

      error = result.error;
    }

    if (error) {
      setMessageType("error");
      setMessage(error.message);
      setSaving(false);
      return;
    }

    await supabase
      .from("profiles")
      .update({
        weight_kg: numberOrNull(form.weight),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    setShowForm(false);
    setEditingEntryId(null);
    setMessageType("success");
    setMessage("Progress entry successfully saved.");

    await loadProgress();
    setSaving(false);
  }

  async function deleteEntry(entry: ProgressEntry) {
    const confirmed = window.confirm(
      `Delete progress entry from ${formatDate(entry.entry_date)}?`,
    );

    if (!confirmed) return;

    setSaving(true);

    const photoPaths = [
      entry.front_photo,
      entry.side_photo,
      entry.back_photo,
    ].filter(Boolean) as string[];

    if (photoPaths.length > 0) {
      await supabase.storage
        .from("progress-photos")
        .remove(photoPaths);
    }

    const { error } = await supabase
      .from("progress_entries")
      .delete()
      .eq("id", entry.id)
      .eq("user_id", userId);

    if (error) {
      setMessageType("error");
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setMessageType("success");
    setMessage("Progress entry deleted.");

    await loadProgress();
    setSaving(false);
  }

  async function uploadPhoto(
    event: ChangeEvent<HTMLInputElement>,
    type: PhotoType,
  ) {
    const file = event.target.files?.[0];

    if (!file || !userId) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessageType("error");
      setMessage("Use JPG, PNG or WebP image.");
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      setMessageType("error");
      setMessage("Photo must be smaller than 6 MB.");
      return;
    }

    let entry = latestEntry;

    if (!entry) {
      const { data, error } = await supabase
        .from("progress_entries")
        .upsert(
          {
            user_id: userId,
            entry_date: getDateString(new Date()),
            weight: profile?.weight_kg ?? null,
          },
          {
            onConflict: "user_id,entry_date",
          },
        )
        .select("*")
        .single();

      if (error) {
        setMessageType("error");
        setMessage(error.message);
        return;
      }

      entry = data as ProgressEntry;
    }

    setUploadingPhoto(type);
    setMessage("");

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";

    const path = `${userId}/${entry.entry_date}/${type}-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("progress-photos")
      .upload(path, file, {
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      setMessageType("error");
      setMessage(uploadError.message);
      setUploadingPhoto(null);
      return;
    }

    const column = `${type}_photo`;

    const { error: updateError } = await supabase
      .from("progress_entries")
      .update({
        [column]: path,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entry.id)
      .eq("user_id", userId);

    if (updateError) {
      setMessageType("error");
      setMessage(updateError.message);
      setUploadingPhoto(null);
      return;
    }

    setMessageType("success");
    setMessage(`${type} photo uploaded.`);

    await loadProgress();
    setUploadingPhoto(null);
  }

  async function deletePhoto(type: PhotoType) {
    if (!latestEntry) return;

    const column = `${type}_photo` as
      | "front_photo"
      | "side_photo"
      | "back_photo";

    const path = latestEntry[column];

    if (!path) return;

    const confirmed = window.confirm(
      `Delete ${type} progress photo?`,
    );

    if (!confirmed) return;

    setUploadingPhoto(type);

    await supabase.storage
      .from("progress-photos")
      .remove([path]);

    const { error } = await supabase
      .from("progress_entries")
      .update({
        [column]: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", latestEntry.id);

    if (error) {
      setMessageType("error");
      setMessage(error.message);
      setUploadingPhoto(null);
      return;
    }

    setMessageType("success");
    setMessage(`${type} photo deleted.`);

    await loadProgress();
    setUploadingPhoto(null);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          <p className="mt-5 text-sm text-zinc-400">
            Loading your progress...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[10%] top-[-350px] h-[750px] w-[750px] rounded-full bg-purple-700/20 blur-[180px]" />
        <div className="absolute -right-80 top-[35%] h-[700px] w-[700px] rounded-full bg-fuchsia-900/10 blur-[180px]" />
        <div className="absolute bottom-[-400px] left-[35%] h-[700px] w-[700px] rounded-full bg-violet-900/10 blur-[180px]" />
      </div>

      <div className="relative mx-auto max-w-[1550px] px-5 py-7 sm:px-8 lg:px-10">
        <header className="flex flex-col justify-between gap-6 border-b border-white/[0.06] pb-8 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.22em] text-purple-400">
              ZENTRO PROGRESS INTELLIGENCE
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Results you can measure.
            </h1>

            <p className="mt-3 max-w-2xl leading-7 text-zinc-500">
              Track body weight, measurements, progress photos and long-term
              transformation in one professional dashboard.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm font-bold text-zinc-300 transition hover:border-purple-500/30"
            >
              ← Dashboard
            </Link>

            <button
              type="button"
              onClick={openNewEntry}
              className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-3 text-sm font-bold shadow-[0_0_30px_rgba(139,92,246,0.2)] transition hover:scale-[1.02]"
            >
              + Add progress entry
            </button>
          </div>
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

        <section className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Current weight"
            value={currentWeight ? currentWeight.toFixed(1) : "—"}
            unit="kg"
            description="Latest recorded weight"
            icon="W"
          />

          <StatCard
            label="Total change"
            value={weightChange ? Math.abs(weightChange).toFixed(1) : "0.0"}
            unit="kg"
            description={
              weightChange < 0
                ? "Weight reduced"
                : weightChange > 0
                  ? "Weight increased"
                  : "No change yet"
            }
            icon={weightChange <= 0 ? "↘" : "↗"}
            positive={weightChange < 0}
          />

          <StatCard
            label="Weekly change"
            value={weeklyChange ? Math.abs(weeklyChange).toFixed(1) : "0.0"}
            unit="kg"
            description="Compared with previous entry"
            icon="7D"
            positive={weeklyChange < 0}
          />

          <StatCard
            label="Body fat"
            value={latestEntry?.body_fat?.toFixed(1) ?? "—"}
            unit="%"
            description="Latest recorded estimate"
            icon="BF"
          />

          <StatCard
            label="BMI"
            value={bmi ? bmi.toFixed(1) : "—"}
            unit=""
            description="Based on height and weight"
            icon="BMI"
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <article className="rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <p className="text-sm text-zinc-500">Weight analytics</p>
                <h2 className="mt-2 text-3xl font-black">
                  Transformation trend
                </h2>
              </div>

              <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-2 text-xs font-bold text-purple-300">
                {entries.length} ENTRIES
              </span>
            </div>

            <div className="mt-8 h-[340px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient
                        id="weightGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#8b5cf6"
                          stopOpacity={0.45}
                        />
                        <stop
                          offset="95%"
                          stopColor="#8b5cf6"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke="rgba(255,255,255,0.05)"
                    />

                    <XAxis
                      dataKey="date"
                      stroke="#52525b"
                      tickLine={false}
                      axisLine={false}
                    />

                    <YAxis
                      stroke="#52525b"
                      tickLine={false}
                      axisLine={false}
                      domain={["dataMin - 2", "dataMax + 2"]}
                    />

                    <Tooltip
                      contentStyle={{
                        background: "#0b0b10",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "16px",
                      }}
                    />

                    <Area
                      type="monotone"
                      dataKey="weight"
                      stroke="#a78bfa"
                      strokeWidth={3}
                      fill="url(#weightGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  title="No progress data yet"
                  description="Add your first measurement to activate the chart."
                  action={openNewEntry}
                />
              )}
            </div>
          </article>

          <article className="rounded-[34px] border border-purple-500/15 bg-gradient-to-br from-purple-600/15 via-purple-950/10 to-transparent p-6 sm:p-8">
            <p className="text-sm text-purple-300">Personal strategy</p>

            <h2 className="mt-2 text-3xl font-black">
              {getGoalLabel(profile?.goal)}
            </h2>

            <p className="mt-4 text-sm leading-7 text-zinc-500">
              Consistent weekly measurements create a clearer picture than
              daily weight fluctuations.
            </p>

            <div className="mt-8 space-y-4">
              <InfoRow
                label="Current weight"
                value={currentWeight ? `${currentWeight.toFixed(1)} kg` : "—"}
              />

              <InfoRow
                label="Height"
                value={
                  profile?.height_cm ? `${profile.height_cm} cm` : "—"
                }
              />

              <InfoRow
                label="Tracking entries"
                value={`${entries.length}`}
              />

              <InfoRow
                label="Last update"
                value={
                  latestEntry
                    ? formatDate(latestEntry.entry_date)
                    : "Not recorded"
                }
              />

              <InfoRow label="Database status" value="Synced" positive />
            </div>
          </article>
        </section>

        <section className="mt-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-bold tracking-[0.18em] text-purple-400">
                BODY MEASUREMENTS
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Latest body composition
              </h2>
            </div>

            <button
              type="button"
              onClick={openNewEntry}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm font-bold text-zinc-300 transition hover:border-purple-500/30"
            >
              Update measurements
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <MeasurementCard
              label="Chest"
              value={latestEntry?.chest}
            />

            <MeasurementCard
              label="Waist"
              value={latestEntry?.waist}
            />

            <MeasurementCard
              label="Hips"
              value={latestEntry?.hips}
            />

            <MeasurementCard
              label="Arms"
              value={latestEntry?.arms}
            />

            <MeasurementCard
              label="Thighs"
              value={latestEntry?.thighs}
            />

            <MeasurementCard
              label="Neck"
              value={latestEntry?.neck}
            />

            <MeasurementCard
              label="Body fat"
              value={latestEntry?.body_fat}
              unit="%"
            />

            <MeasurementCard
              label="Weight"
              value={latestEntry?.weight}
              unit="kg"
            />
          </div>
        </section>

        <section className="mt-8 rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-6 sm:p-8">
          <div>
            <p className="text-sm font-bold tracking-[0.18em] text-purple-400">
              PROGRESS PHOTOS
            </p>

            <h2 className="mt-2 text-3xl font-black">
              Visual transformation
            </h2>

            <p className="mt-3 text-sm leading-7 text-zinc-500">
              Use consistent lighting, distance and posture for more reliable
              comparisons.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {(["front", "side", "back"] as PhotoType[]).map((type) => (
              <PhotoCard
                key={type}
                type={type}
                url={photoUrls[type]}
                uploading={uploadingPhoto === type}
                onUpload={(event) => void uploadPhoto(event, type)}
                onDelete={() => void deletePhoto(type)}
              />
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-sm text-zinc-500">Progress history</p>

              <h2 className="mt-2 text-3xl font-black">
                Measurement timeline
              </h2>
            </div>

            <button
              type="button"
              onClick={openNewEntry}
              className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-bold"
            >
              Add new entry
            </button>
          </div>

          <div className="mt-8 space-y-4">
            {[...entries].reverse().map((entry) => (
              <article
                key={entry.id}
                className="flex flex-col gap-5 rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5 lg:flex-row lg:items-center"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-purple-500/10 text-sm font-black text-purple-300">
                  {new Date(`${entry.entry_date}T12:00:00`).getDate()}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {formatDate(entry.entry_date)}
                  </p>

                  <p className="mt-1 truncate text-sm text-zinc-600">
                    {entry.notes || "No notes added."}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 lg:w-[360px]">
                  <MiniStat
                    label="Weight"
                    value={
                      entry.weight ? `${entry.weight} kg` : "—"
                    }
                  />

                  <MiniStat
                    label="Waist"
                    value={entry.waist ? `${entry.waist} cm` : "—"}
                  />

                  <MiniStat
                    label="Body fat"
                    value={
                      entry.body_fat
                        ? `${entry.body_fat}%`
                        : "—"
                    }
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEditEntry(entry)}
                    className="rounded-xl border border-white/[0.08] px-4 py-3 text-xs font-bold text-zinc-300"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void deleteEntry(entry)}
                    className="rounded-xl border border-red-500/15 px-4 py-3 text-xs font-bold text-red-300 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}

            {entries.length === 0 && (
              <EmptyState
                title="Your timeline is empty"
                description="Add your first progress entry to begin tracking."
                action={openNewEntry}
              />
            )}
          </div>
        </section>

        <footer className="mt-10 border-t border-white/[0.05] py-8 text-xs leading-6 text-zinc-700">
          Body measurements and BMI are general fitness indicators and do not
          replace medical assessment from a qualified professional.
        </footer>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/85 px-5 py-10 backdrop-blur-md"
          onClick={() => setShowForm(false)}
        >
          <section
            className="mx-auto w-full max-w-3xl rounded-[34px] border border-white/10 bg-[#0b0b10] p-7 shadow-2xl sm:p-9"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold tracking-[0.2em] text-purple-400">
                  {editingEntryId ? "EDIT ENTRY" : "NEW PROGRESS ENTRY"}
                </p>

                <h2 className="mt-3 text-3xl font-black">
                  Record your measurements
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-xl text-zinc-500"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={saveEntry}
              className="mt-8 grid gap-5 sm:grid-cols-2"
            >
              <InputField
                label="Entry date"
                type="date"
                value={form.entryDate}
                onChange={(value) => updateField("entryDate", value)}
                required
              />

              <InputField
                label="Weight (kg)"
                type="number"
                value={form.weight}
                onChange={(value) => updateField("weight", value)}
                required
              />

              <InputField
                label="Body fat (%)"
                type="number"
                value={form.bodyFat}
                onChange={(value) => updateField("bodyFat", value)}
              />

              <InputField
                label="Chest (cm)"
                type="number"
                value={form.chest}
                onChange={(value) => updateField("chest", value)}
              />

              <InputField
                label="Waist (cm)"
                type="number"
                value={form.waist}
                onChange={(value) => updateField("waist", value)}
              />

              <InputField
                label="Hips (cm)"
                type="number"
                value={form.hips}
                onChange={(value) => updateField("hips", value)}
              />

              <InputField
                label="Arms (cm)"
                type="number"
                value={form.arms}
                onChange={(value) => updateField("arms", value)}
              />

              <InputField
                label="Thighs (cm)"
                type="number"
                value={form.thighs}
                onChange={(value) => updateField("thighs", value)}
              />

              <InputField
                label="Neck (cm)"
                type="number"
                value={form.neck}
                onChange={(value) => updateField("neck", value)}
              />

              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm text-zinc-400">
                  Notes
                </label>

                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    updateField("notes", event.target.value)
                  }
                  rows={4}
                  placeholder="How are you feeling? What changed this week?"
                  className="w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none placeholder:text-zinc-700 focus:border-purple-500/50"
                />
              </div>

              <div className="mt-2 grid gap-3 sm:col-span-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-2xl border border-white/[0.08] px-6 py-4 font-bold text-zinc-400"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-4 font-bold disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save progress entry"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  unit,
  description,
  icon,
  positive = false,
}: {
  label: string;
  value: string;
  unit: string;
  description: string;
  icon: string;
  positive?: boolean;
}) {
  return (
    <article className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6 transition hover:-translate-y-1 hover:border-purple-500/25">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xs font-black ${
          positive
            ? "bg-emerald-500/10 text-emerald-300"
            : "bg-purple-500/10 text-purple-300"
        }`}
      >
        {icon}
      </div>

      <p className="mt-6 text-sm text-zinc-500">{label}</p>

      <p className="mt-2 text-3xl font-black">
        {value}
        {unit && (
          <span className="ml-2 text-sm font-normal text-zinc-600">
            {unit}
          </span>
        )}
      </p>

      <p className="mt-3 text-xs text-zinc-600">{description}</p>
    </article>
  );
}

function MeasurementCard({
  label,
  value,
  unit = "cm",
}: {
  label: string;
  value?: number | null;
  unit?: string;
}) {
  return (
    <article className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6">
      <p className="text-sm text-zinc-500">{label}</p>

      <p className="mt-3 text-3xl font-black">
        {value ?? "—"}

        {value && (
          <span className="ml-2 text-sm font-normal text-zinc-600">
            {unit}
          </span>
        )}
      </p>
    </article>
  );
}

function PhotoCard({
  type,
  url,
  uploading,
  onUpload,
  onDelete,
}: {
  type: PhotoType;
  url: string | null;
  uploading: boolean;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onDelete: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.025]">
      <div className="relative flex aspect-[3/4] items-center justify-center bg-black/30">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={`${type} progress`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-2xl text-purple-300">
              +
            </div>

            <p className="mt-4 text-sm text-zinc-500">
              No {type} photo
            </p>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          </div>
        )}
      </div>

      <div className="p-5">
        <p className="font-bold capitalize">{type} photo</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="cursor-pointer rounded-xl bg-purple-600 px-4 py-3 text-center text-xs font-bold">
            {url ? "Replace" : "Upload"}

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onUpload}
              className="hidden"
            />
          </label>

          <button
            type="button"
            disabled={!url || uploading}
            onClick={onDelete}
            className="rounded-xl border border-red-500/15 px-4 py-3 text-xs font-bold text-red-300 disabled:opacity-30"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

function InputField({
  label,
  type,
  value,
  onChange,
  required = false,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-zinc-400">
        {label}
      </label>

      <input
        type={type}
        value={value}
        required={required}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.1" : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none focus:border-purple-500/50"
      />
    </div>
  );
}

function InfoRow({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.05] pb-4 text-sm last:border-none last:pb-0">
      <span className="text-zinc-600">{label}</span>

      <span
        className={
          positive
            ? "font-semibold text-emerald-400"
            : "font-semibold text-zinc-300"
        }
      >
        {value}
      </span>
    </div>
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

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: () => void;
}) {
  return (
    <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-2xl text-purple-300">
        +
      </div>

      <h3 className="mt-5 text-xl font-black">{title}</h3>

      <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-600">
        {description}
      </p>

      <button
        type="button"
        onClick={action}
        className="mt-6 rounded-2xl bg-purple-600 px-5 py-3 text-sm font-bold"
      >
        Add progress entry
      </button>
    </div>
  );
}
