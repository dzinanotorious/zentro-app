"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type NotificationPreferences = {
  notifications_enabled: boolean;
  motivational_notifications: boolean;
  workout_reminders: boolean;
  streak_reminders: boolean;
  preferred_time: string;
  timezone: string;
};

const defaultPreferences: NotificationPreferences = {
  notifications_enabled: false,
  motivational_notifications: true,
  workout_reminders: true,
  streak_reminders: true,
  preferred_time: "09:00",
  timezone: "Europe/Skopje",
};

function urlBase64ToUint8Array(
  base64String: string,
) {
  const padding = "=".repeat(
    (4 - (base64String.length % 4)) % 4,
  );

  const base64 = (
    base64String + padding
  )
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((character) =>
      character.charCodeAt(0),
    ),
  );
}

async function getPushSubscription() {
  if (!("serviceWorker" in navigator)) {
    throw new Error(
      "This browser does not support service workers.",
    );
  }

  if (!("PushManager" in window)) {
    throw new Error(
      "This browser does not support push notifications.",
    );
  }

  const registration =
    await navigator.serviceWorker.ready;

  const existingSubscription =
    await registration.pushManager.getSubscription();

  if (existingSubscription) {
    return existingSubscription;
  }

  const vapidPublicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!vapidPublicKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY.",
    );
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey:
      urlBase64ToUint8Array(
        vapidPublicKey,
      ),
  });
}

export default function NotificationsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(defaultPreferences);

  const [browserPermission, setBrowserPermission] =
    useState<NotificationPermission>("default");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [pushSubscribed, setPushSubscribed] =
    useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error"
  >("success");

  useEffect(() => {
    async function registerServiceWorker() {
      if (!("serviceWorker" in navigator)) {
        return;
      }

      try {
        await navigator.serviceWorker.register(
          "/sw.js",
        );

        const registration =
          await navigator.serviceWorker.ready;

        const subscription =
          await registration.pushManager.getSubscription();

        setPushSubscribed(Boolean(subscription));
      } catch (error) {
        console.error(
          "Service worker registration error:",
          error,
        );
      }
    }

    void registerServiceWorker();
  }, []);

  useEffect(() => {
    async function loadPreferences() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);

      if ("Notification" in window) {
        setBrowserPermission(Notification.permission);
      }

      const { data, error } = await supabase
        .from("notification_preferences")
        .select(
          `
            notifications_enabled,
            motivational_notifications,
            workout_reminders,
            streak_reminders,
            preferred_time,
            timezone
          `,
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        setMessageType("error");
        setMessage(error.message);
        setLoading(false);
        return;
      }

      if (data) {
        setPreferences({
          notifications_enabled:
            data.notifications_enabled ?? false,
          motivational_notifications:
            data.motivational_notifications ?? true,
          workout_reminders:
            data.workout_reminders ?? true,
          streak_reminders:
            data.streak_reminders ?? true,
          preferred_time:
            data.preferred_time?.slice(0, 5) ?? "09:00",
          timezone: data.timezone ?? "Europe/Skopje",
        });
      }

      setLoading(false);
    }

    void loadPreferences();
  }, [router]);

  async function savePushSubscription(
    subscription: PushSubscription,
  ) {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error(
        "Your login session is invalid or expired.",
      );
    }

    const response = await fetch(
      "/api/push/subscribe",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(
          subscription.toJSON(),
        ),
      },
    );

    const contentType =
      response.headers.get("content-type") ?? "";

    const result = contentType.includes(
      "application/json",
    )
      ? await response.json()
      : {
          error: `Server error (${response.status}).`,
        };

    if (!response.ok) {
      throw new Error(
        result.error ||
          "Could not save push subscription.",
      );
    }
  }

  async function subscribeToPushNotifications() {
    setSubscribing(true);

    try {
      const subscription =
        await getPushSubscription();

      await savePushSubscription(subscription);

      setPushSubscribed(true);

      return subscription;
    } finally {
      setSubscribing(false);
    }
  }

  async function requestNotificationPermission() {
    setMessage("");

    if (!("Notification" in window)) {
      setMessageType("error");
      setMessage(
        "Овој browser не поддржува системски нотификации.",
      );
      return;
    }

    const permission = await Notification.requestPermission();

    setBrowserPermission(permission);

    if (permission === "granted") {
      try {
        await subscribeToPushNotifications();

        setPreferences((current) => ({
          ...current,
          notifications_enabled: true,
        }));

        setMessageType("success");
        setMessage(
          "Push notifications are enabled and connected successfully.",
        );

        await showTestNotification();
      } catch (error) {
        setPreferences((current) => ({
          ...current,
          notifications_enabled: false,
        }));

        setMessageType("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not enable push notifications.",
        );
      }

      return;
    }

    if (permission === "denied") {
      setPreferences((current) => ({
        ...current,
        notifications_enabled: false,
      }));

      setMessageType("error");
      setMessage(
        "Нотификациите се блокирани. Ќе треба да ги дозволиш преку browser settings.",
      );

      return;
    }

    setMessageType("error");
    setMessage("Не беше дадена дозвола за нотификации.");
  }

  async function showTestNotification() {
    if (Notification.permission !== "granted") return;

    const registration =
      await navigator.serviceWorker?.getRegistration();

    if (registration) {
      await registration.showNotification("Zentro Motivation", {
        body: "Секој голем резултат започнува со една мала одлука.",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "zentro-test-notification",
        data: {
          url: "/dashboard",
        },
      });

      return;
    }

    new Notification("Zentro Motivation", {
      body: "Секој голем резултат започнува со една мала одлука.",
      icon: "/icon-192.png",
    });
  }

  async function savePreferences() {
    if (!userId) return;

    setSaving(true);
    setMessage("");

    let notificationsEnabled =
      preferences.notifications_enabled &&
      browserPermission === "granted";

    if (
      notificationsEnabled &&
      !pushSubscribed
    ) {
      try {
        await subscribeToPushNotifications();
        notificationsEnabled = true;
      } catch (error) {
        setMessageType("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not connect push notifications.",
        );
        setSaving(false);
        return;
      }
    }

    const { error } = await supabase
      .from("notification_preferences")
      .upsert(
        {
          user_id: userId,
          notifications_enabled: notificationsEnabled,
          motivational_notifications:
            preferences.motivational_notifications,
          workout_reminders:
            preferences.workout_reminders,
          streak_reminders:
            preferences.streak_reminders,
          preferred_time: preferences.preferred_time,
          timezone: preferences.timezone,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        },
      );

    if (error) {
      setMessageType("error");
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setPreferences((current) => ({
      ...current,
      notifications_enabled: notificationsEnabled,
    }));

    setMessageType("success");
    setMessage("Notification settings successfully saved.");
    setSaving(false);
  }

  function updatePreference<
    Key extends keyof NotificationPreferences,
  >(key: Key, value: NotificationPreferences[Key]) {
    setPreferences((current) => ({
      ...current,
      [key]: value,
    }));
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />

          <p className="mt-5 text-sm text-zinc-400">
            Loading notification settings...
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
      </div>

      <div className="relative mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <header className="flex flex-col justify-between gap-6 border-b border-white/[0.06] pb-8 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.22em] text-purple-400">
              ZENTRO NOTIFICATIONS
            </p>

            <h1 className="mt-3 text-4xl font-black sm:text-5xl">
              Stay consistent every day.
            </h1>

            <p className="mt-4 max-w-2xl leading-7 text-zinc-500">
              Choose when Zentro should motivate you, remind you to
              train and help protect your streak.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-center text-sm font-bold text-zinc-300"
          >
            ← Dashboard
          </Link>
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

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.75fr]">
          <div className="space-y-6">
            <article className="rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-7 sm:p-9">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm text-zinc-500">
                    Browser permission
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    Enable system notifications
                  </h2>

                  <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-600">
                    Your browser must allow notifications before Zentro
                    can send motivation and workout reminders.
                  </p>
                </div>

                <PermissionBadge permission={browserPermission} />
              </div>

              <button
                type="button"
                onClick={() => {
                  if (
                    browserPermission === "granted"
                  ) {
                    void subscribeToPushNotifications()
                      .then(() => {
                        setMessageType("success");
                        setMessage(
                          "Push notifications connected successfully.",
                        );
                      })
                      .catch((error) => {
                        setMessageType("error");
                        setMessage(
                          error instanceof Error
                            ? error.message
                            : "Could not connect push notifications.",
                        );
                      });

                    return;
                  }

                  void requestNotificationPermission();
                }}
                disabled={
                  subscribing ||
                  (browserPermission === "granted" &&
                    pushSubscribed)
                }
                className="mt-7 w-full rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-4 font-bold disabled:cursor-not-allowed disabled:opacity-40"
              >
                {subscribing
                  ? "Connecting push notifications..."
                  : browserPermission === "granted" &&
                      pushSubscribed
                    ? "Push notifications connected ✓"
                    : browserPermission === "granted"
                      ? "Connect push notifications"
                      : "Allow notifications"}
              </button>

              {browserPermission === "denied" && (
                <p className="mt-4 text-xs leading-6 text-red-300">
                  Кликни на иконата до адресата во browser-от, отвори
                  Site permissions и смени Notifications на Allow.
                </p>
              )}
            </article>

            <article className="rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-7 sm:p-9">
              <p className="text-sm text-zinc-500">
                Notification categories
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Choose what you receive
              </h2>

              <div className="mt-7 space-y-4">
                <ToggleRow
                  title="Daily motivation"
                  description="Receive one motivational fitness message each day."
                  checked={
                    preferences.motivational_notifications
                  }
                  onChange={(value) =>
                    updatePreference(
                      "motivational_notifications",
                      value,
                    )
                  }
                />

                <ToggleRow
                  title="Workout reminders"
                  description="Get reminded when it is time to complete your workout."
                  checked={preferences.workout_reminders}
                  onChange={(value) =>
                    updatePreference(
                      "workout_reminders",
                      value,
                    )
                  }
                />

                <ToggleRow
                  title="Streak protection"
                  description="Receive a warning when your active streak is at risk."
                  checked={preferences.streak_reminders}
                  onChange={(value) =>
                    updatePreference(
                      "streak_reminders",
                      value,
                    )
                  }
                />
              </div>
            </article>

            <article className="rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-7 sm:p-9">
              <p className="text-sm text-zinc-500">
                Delivery schedule
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Select your preferred time
              </h2>

              <div className="mt-7 grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Daily notification time
                  </label>

                  <input
                    type="time"
                    value={preferences.preferred_time}
                    onChange={(event) =>
                      updatePreference(
                        "preferred_time",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none focus:border-purple-500/50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Timezone
                  </label>

                  <select
                    value={preferences.timezone}
                    onChange={(event) =>
                      updatePreference(
                        "timezone",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-purple-500/50"
                  >
                    <option value="Europe/Skopje">
                      Europe/Skopje
                    </option>
                    <option value="Europe/Berlin">
                      Europe/Berlin
                    </option>
                    <option value="Europe/London">
                      Europe/London
                    </option>
                    <option value="America/New_York">
                      America/New York
                    </option>
                    <option value="America/Los_Angeles">
                      America/Los Angeles
                    </option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void savePreferences()}
                disabled={saving}
                className="mt-7 w-full rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-4 font-bold disabled:opacity-50"
              >
                {saving
                  ? "Saving settings..."
                  : "Save notification settings"}
              </button>
            </article>
          </div>

          <aside className="space-y-6">
            <article className="rounded-[34px] border border-purple-500/15 bg-gradient-to-br from-purple-600/15 to-transparent p-7">
              <p className="text-sm text-purple-300">
                Daily motivation preview
              </p>

              <div className="mt-6 rounded-3xl border border-white/[0.08] bg-black/30 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/15 font-black text-purple-300">
                    Z
                  </div>

                  <div>
                    <p className="font-bold">Zentro Motivation</p>

                    <p className="text-xs text-zinc-600">
                      Today at {preferences.preferred_time}
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-sm leading-7 text-zinc-400">
                  You do not need a perfect workout. You only need
                  to start.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void showTestNotification()}
                disabled={browserPermission !== "granted"}
                className="mt-5 w-full rounded-2xl border border-purple-500/20 bg-purple-500/10 px-5 py-4 text-sm font-bold text-purple-300 disabled:opacity-30"
              >
                Send test notification
              </button>
            </article>

            <article className="rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-7">
              <h2 className="text-xl font-black">
                Current configuration
              </h2>

              <div className="mt-6 space-y-4">
                <InfoRow
                  label="Browser permission"
                  value={browserPermission}
                />

                <InfoRow
                  label="Push subscription"
                  value={
                    pushSubscribed
                      ? "Connected"
                      : "Not connected"
                  }
                />

                <InfoRow
                  label="Daily motivation"
                  value={
                    preferences.motivational_notifications
                      ? "Enabled"
                      : "Disabled"
                  }
                />

                <InfoRow
                  label="Preferred time"
                  value={preferences.preferred_time}
                />

                <InfoRow
                  label="Timezone"
                  value={preferences.timezone}
                />
              </div>
            </article>

            <article className="rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-7">
              <p className="text-sm font-bold text-purple-300">
                Important
              </p>

              <p className="mt-4 text-sm leading-7 text-zinc-600">
                Browser permission, service worker registration and
                push subscription are now connected. The next step is
                adding a secure server sender and scheduled delivery for
                workout, nutrition and streak reminders.
              </p>
            </article>
          </aside>
        </section>
      </div>
    </main>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div>
        <p className="font-bold">{title}</p>

        <p className="mt-2 text-sm leading-6 text-zinc-600">
          {description}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? "bg-purple-600" : "bg-zinc-800"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

function PermissionBadge({
  permission,
}: {
  permission: NotificationPermission;
}) {
  const styles = {
    granted:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    denied:
      "border-red-500/20 bg-red-500/10 text-red-300",
    default:
      "border-amber-500/20 bg-amber-500/10 text-amber-300",
  };

  return (
    <span
      className={`rounded-full border px-4 py-2 text-xs font-bold ${styles[permission]}`}
    >
      {permission.toUpperCase()}
    </span>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.05] pb-4 text-sm last:border-none last:pb-0">
      <span className="text-zinc-600">{label}</span>

      <span className="max-w-[60%] truncate text-right font-semibold text-zinc-300">
        {value}
      </span>
    </div>
  );
}
