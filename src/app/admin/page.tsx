"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Overview = {
  generatedAt: string;
  totals: {
    users: number;
    proUsers: number;
    disabledUsers: number;
    admins: number;
    activeSubscriptions: number;
    monthlySubscribers: number;
    yearlySubscribers: number;
    estimatedMrrEur: number;
    estimatedArrEur: number;
    aiCoachMessagesToday: number;
    foodScansToday: number;
    foodScansAllTime: number;
    pushSubscriptions: number;
    nutritionLogsToday: number;
    conversationsAllTime: number;
  };
  recentActivity: Array<{
    id: string;
    type: "coach" | "food_scan" | "subscription" | "admin";
    title: string;
    description: string;
    createdAt: string;
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    targetUserId: string | null;
    details: Record<string, unknown>;
    createdAt: string;
  }>;
};

type AdminUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  isAdmin: boolean;
  isDisabled: boolean;
  planCode: "free" | "pro";
  subscriptionStatus: string;
  billingPeriod: string | null;
  aiCoachMessagesToday: number;
  foodScansToday: number;
  pushSubscriptions: number;
};

type UsersResponse = {
  users: AdminUser[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

type UserFilter = "all" | "pro" | "free" | "admin" | "disabled";

const EMPTY_OVERVIEW: Overview = {
  generatedAt: new Date(0).toISOString(),
  totals: {
    users: 0,
    proUsers: 0,
    disabledUsers: 0,
    admins: 0,
    activeSubscriptions: 0,
    monthlySubscribers: 0,
    yearlySubscribers: 0,
    estimatedMrrEur: 0,
    estimatedArrEur: 0,
    aiCoachMessagesToday: 0,
    foodScansToday: 0,
    foodScansAllTime: 0,
    pushSubscriptions: 0,
    nutritionLogsToday: 0,
    conversationsAllTime: 0,
  },
  recentActivity: [],
  recentAuditLogs: [],
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "Never";

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function getAccessToken() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new Error("Your session is invalid or expired.");
  }

  return session.access_token;
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const contentType =
    response.headers.get("content-type") ?? "";

  const result = contentType.includes("application/json")
    ? await response.json()
    : {
        error: `Server returned ${response.status}.`,
      };

  if (!response.ok) {
    throw new Error(
      result.error || "The request could not be completed.",
    );
  }

  return result as T;
}

export default function AdminPage() {
  const router = useRouter();

  const [overview, setOverview] =
    useState<Overview>(EMPTY_OVERVIEW);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersMeta, setUsersMeta] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");

  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyUserId, setBusyUserId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [notificationOpen, setNotificationOpen] =
    useState(false);
  const [notificationTarget, setNotificationTarget] =
    useState<AdminUser | null>(null);
  const [notificationTitle, setNotificationTitle] =
    useState("Zentro");
  const [notificationBody, setNotificationBody] =
    useState("");
  const [notificationUrl, setNotificationUrl] =
    useState("/dashboard");
  const [sendingNotification, setSendingNotification] =
    useState(false);

  const loadOverview = useCallback(async () => {
    const token = await getAccessToken();

    const response = await fetch("/api/admin/overview", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (response.status === 403) {
      router.replace("/dashboard");
      throw new Error("Admin access required.");
    }

    const data = await parseApiResponse<Overview>(response);
    setOverview(data);
  }, [router]);

  const loadUsers = useCallback(
    async (
      page = 1,
      nextSearch = appliedSearch,
      nextFilter = filter,
    ) => {
      setLoadingUsers(true);

      try {
        const token = await getAccessToken();
        const params = new URLSearchParams({
          page: String(page),
          perPage: "20",
          search: nextSearch,
          filter: nextFilter,
        });

        const response = await fetch(
          `/api/admin/users?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          },
        );

        if (response.status === 403) {
          router.replace("/dashboard");
          return;
        }

        const data =
          await parseApiResponse<UsersResponse>(response);

        setUsers(data.users);
        setUsersMeta({
          page: data.page,
          totalPages: data.totalPages,
          total: data.total,
        });
      } finally {
        setLoadingUsers(false);
      }
    },
    [appliedSearch, filter, router],
  );

  const loadAll = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        await Promise.all([
          loadOverview(),
          loadUsers(1),
        ]);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load admin data.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadOverview, loadUsers],
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const proConversion = useMemo(() => {
    if (overview.totals.users === 0) return 0;

    return Math.round(
      (overview.totals.proUsers /
        overview.totals.users) *
        100,
    );
  }, [
    overview.totals.proUsers,
    overview.totals.users,
  ]);

  async function runUserAction(
    user: AdminUser,
    action:
      | "set_plan"
      | "set_admin"
      | "set_disabled",
    value: string | boolean,
  ) {
    const labels = {
      set_plan: `change ${user.email ?? "this user"} to ${String(
        value,
      ).toUpperCase()}`,
      set_admin: `${
        value ? "grant" : "remove"
      } admin access for ${user.email ?? "this user"}`,
      set_disabled: `${
        value ? "disable" : "enable"
      } ${user.email ?? "this user"}`,
    };

    const confirmed = window.confirm(
      `Are you sure you want to ${labels[action]}?`,
    );

    if (!confirmed) return;

    setBusyUserId(user.id);
    setError("");
    setSuccess("");

    try {
      const token = await getAccessToken();

      const response = await fetch(
        `/api/admin/users/${user.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action,
            value,
          }),
        },
      );

      const result = await parseApiResponse<{
        success: boolean;
        message: string;
      }>(response);

      setSuccess(result.message);

      await Promise.all([
        loadOverview(),
        loadUsers(usersMeta.page),
      ]);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Admin action failed.",
      );
    } finally {
      setBusyUserId("");
    }
  }

  function submitSearch(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const nextSearch = search.trim();
    setAppliedSearch(nextSearch);
    void loadUsers(1, nextSearch, filter);
  }

  function changeFilter(nextFilter: UserFilter) {
    setFilter(nextFilter);
    void loadUsers(1, appliedSearch, nextFilter);
  }

  function openNotification(user: AdminUser | null) {
    setNotificationTarget(user);
    setNotificationTitle("Zentro");
    setNotificationBody("");
    setNotificationUrl("/dashboard");
    setNotificationOpen(true);
  }

  async function sendNotification() {
    if (!notificationBody.trim()) {
      setError("Notification message is required.");
      return;
    }

    setSendingNotification(true);
    setError("");
    setSuccess("");

    try {
      const token = await getAccessToken();

      const response = await fetch(
        "/api/admin/notifications/send",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            targetUserId:
              notificationTarget?.id ?? null,
            title: notificationTitle.trim() || "Zentro",
            body: notificationBody.trim(),
            url: notificationUrl.trim() || "/dashboard",
          }),
        },
      );

      const result = await parseApiResponse<{
        success: boolean;
        sent: number;
        failed: number;
        removedExpired: number;
      }>(response);

      setSuccess(
        `Notification sent to ${result.sent} device(s). ${result.failed} failed.`,
      );
      setNotificationOpen(false);
      await loadOverview();
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Could not send notification.",
      );
    } finally {
      setSendingNotification(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          <p className="mt-5 text-sm text-zinc-400">
            Loading Zentro Admin v2...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[8%] top-[-380px] h-[800px] w-[800px] rounded-full bg-purple-700/20 blur-[190px]" />
        <div className="absolute -right-80 top-[30%] h-[720px] w-[720px] rounded-full bg-fuchsia-900/10 blur-[180px]" />
      </div>

      <div className="relative mx-auto max-w-[1700px] px-5 py-8 sm:px-8 lg:px-10">
        <header className="flex flex-col justify-between gap-6 border-b border-white/[0.06] pb-8 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.22em] text-purple-400">
              ZENTRO CONTROL CENTER V2
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">
              Platform operations
            </h1>

            <p className="mt-4 max-w-3xl leading-7 text-zinc-500">
              Manage users, plans, access, notifications,
              revenue and platform activity from one secure panel.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => openNotification(null)}
              className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-3 text-sm font-bold text-emerald-300"
            >
              Send broadcast
            </button>

            <button
              type="button"
              onClick={() => void loadAll(true)}
              disabled={refreshing}
              className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-3 text-sm font-bold disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <Link
              href="/dashboard"
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm font-bold text-zinc-300"
            >
              ← Dashboard
            </Link>
          </div>
        </header>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {success}
          </div>
        )}

        <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total users"
            value={overview.totals.users}
            helper={`${overview.totals.disabledUsers} disabled`}
            icon="U"
          />
          <MetricCard
            label="Active Pro"
            value={overview.totals.proUsers}
            helper={`${proConversion}% conversion`}
            icon="P"
            accent
          />
          <MetricCard
            label="Estimated MRR"
            value={formatCurrency(
              overview.totals.estimatedMrrEur,
            )}
            helper={`${overview.totals.activeSubscriptions} active plans`}
            icon="€"
            accent
          />
          <MetricCard
            label="Estimated ARR"
            value={formatCurrency(
              overview.totals.estimatedArrEur,
            )}
            helper={`${overview.totals.admins} admins`}
            icon="↗"
          />
        </section>

        <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="AI Coach today"
            value={overview.totals.aiCoachMessagesToday}
            helper={`${overview.totals.conversationsAllTime} conversations`}
            icon="AI"
          />
          <MetricCard
            label="Food scans today"
            value={overview.totals.foodScansToday}
            helper={`${overview.totals.foodScansAllTime} all time`}
            icon="◉"
          />
          <MetricCard
            label="Push devices"
            value={overview.totals.pushSubscriptions}
            helper="Connected subscriptions"
            icon="N"
          />
          <MetricCard
            label="Nutrition logs today"
            value={overview.totals.nutritionLogsToday}
            helper="Active nutrition tracking"
            icon="◎"
          />
        </section>

        <section className="mt-6 rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div>
              <p className="text-sm text-zinc-500">
                User management
              </p>
              <h2 className="mt-2 text-3xl font-black">
                Accounts and access
              </h2>
              <p className="mt-3 text-sm text-zinc-600">
                {usersMeta.total} matching users
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row">
              <form
                onSubmit={submitSearch}
                className="flex min-w-0 gap-2"
              >
                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search name or email..."
                  className="min-w-0 flex-1 rounded-2xl border border-white/[0.08] bg-black/30 px-5 py-3 text-sm outline-none focus:border-purple-500/40 lg:w-72"
                />
                <button
                  type="submit"
                  className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-bold"
                >
                  Search
                </button>
              </form>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    "all",
                    "pro",
                    "free",
                    "admin",
                    "disabled",
                  ] as UserFilter[]
                ).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => changeFilter(item)}
                    className={`rounded-xl border px-4 py-3 text-xs font-bold capitalize ${
                      filter === item
                        ? "border-purple-500/30 bg-purple-500/10 text-purple-300"
                        : "border-white/[0.07] text-zinc-500"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-7 overflow-x-auto">
            <table className="w-full min-w-[1250px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.07] text-xs text-zinc-600">
                  <th className="px-4 py-4">User</th>
                  <th className="px-4 py-4">Plan</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">AI today</th>
                  <th className="px-4 py-4">Push</th>
                  <th className="px-4 py-4">Last sign-in</th>
                  <th className="px-4 py-4">Role</th>
                  <th className="px-4 py-4">Actions</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => {
                  const busy = busyUserId === user.id;

                  return (
                    <tr
                      key={user.id}
                      className="border-b border-white/[0.05] text-sm last:border-none"
                    >
                      <td className="px-4 py-5">
                        <p className="font-bold text-zinc-300">
                          {user.fullName || "Zentro Athlete"}
                        </p>
                        <p className="mt-1 text-xs text-zinc-600">
                          {user.email || "No email"}
                        </p>
                        <p className="mt-1 text-[10px] text-zinc-800">
                          Joined {formatDateTime(user.createdAt)}
                        </p>
                      </td>

                      <td className="px-4 py-5">
                        <StatusBadge
                          value={user.planCode.toUpperCase()}
                          positive={user.planCode === "pro"}
                        />
                        {user.billingPeriod && (
                          <p className="mt-2 text-[10px] text-zinc-700">
                            {user.billingPeriod}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-5">
                        <StatusBadge
                          value={
                            user.isDisabled
                              ? "DISABLED"
                              : user.subscriptionStatus
                          }
                          positive={
                            !user.isDisabled &&
                            ["active", "trialing"].includes(
                              user.subscriptionStatus,
                            )
                          }
                          danger={user.isDisabled}
                        />
                      </td>

                      <td className="px-4 py-5 text-zinc-400">
                        <p>
                          {user.aiCoachMessagesToday} messages
                        </p>
                        <p className="mt-1 text-xs text-zinc-700">
                          {user.foodScansToday} scans
                        </p>
                      </td>

                      <td className="px-4 py-5 text-zinc-400">
                        {user.pushSubscriptions} device(s)
                      </td>

                      <td className="px-4 py-5 text-zinc-600">
                        {formatDateTime(user.lastSignInAt)}
                      </td>

                      <td className="px-4 py-5">
                        <StatusBadge
                          value={user.isAdmin ? "ADMIN" : "USER"}
                          positive={user.isAdmin}
                        />
                      </td>

                      <td className="px-4 py-5">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void runUserAction(
                                user,
                                "set_plan",
                                user.planCode === "pro"
                                  ? "free"
                                  : "pro",
                              )
                            }
                            className="rounded-xl border border-purple-500/15 bg-purple-500/[0.05] px-3 py-2 text-[10px] font-bold text-purple-300 disabled:opacity-40"
                          >
                            {user.planCode === "pro"
                              ? "Set Free"
                              : "Set Pro"}
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void runUserAction(
                                user,
                                "set_admin",
                                !user.isAdmin,
                              )
                            }
                            className="rounded-xl border border-white/[0.08] px-3 py-2 text-[10px] font-bold text-zinc-400 disabled:opacity-40"
                          >
                            {user.isAdmin
                              ? "Remove Admin"
                              : "Make Admin"}
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void runUserAction(
                                user,
                                "set_disabled",
                                !user.isDisabled,
                              )
                            }
                            className={`rounded-xl border px-3 py-2 text-[10px] font-bold disabled:opacity-40 ${
                              user.isDisabled
                                ? "border-emerald-500/15 text-emerald-300"
                                : "border-red-500/15 text-red-300"
                            }`}
                          >
                            {user.isDisabled
                              ? "Enable"
                              : "Disable"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openNotification(user)
                            }
                            className="rounded-xl border border-emerald-500/15 px-3 py-2 text-[10px] font-bold text-emerald-300"
                          >
                            Notify
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {loadingUsers && (
              <div className="py-10 text-center text-sm text-zinc-600">
                Loading users...
              </div>
            )}

            {!loadingUsers && users.length === 0 && (
              <div className="py-10 text-center text-sm text-zinc-600">
                No users match this search.
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-5">
            <button
              type="button"
              disabled={usersMeta.page <= 1 || loadingUsers}
              onClick={() =>
                void loadUsers(usersMeta.page - 1)
              }
              className="rounded-xl border border-white/[0.08] px-4 py-3 text-xs font-bold text-zinc-400 disabled:opacity-30"
            >
              ← Previous
            </button>

            <p className="text-xs text-zinc-600">
              Page {usersMeta.page} of {usersMeta.totalPages}
            </p>

            <button
              type="button"
              disabled={
                usersMeta.page >= usersMeta.totalPages ||
                loadingUsers
              }
              onClick={() =>
                void loadUsers(usersMeta.page + 1)
              }
              className="rounded-xl border border-white/[0.08] px-4 py-3 text-xs font-bold text-zinc-400 disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <article className="rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-7">
            <h2 className="text-2xl font-black">
              Recent platform activity
            </h2>

            <div className="mt-6 space-y-3">
              {overview.recentActivity.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold">{item.title}</p>
                      <p className="mt-1 text-sm text-zinc-600">
                        {item.description}
                      </p>
                    </div>
                    <p className="text-[10px] text-zinc-700">
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[34px] border border-white/[0.07] bg-[#0b0b10]/90 p-7">
            <h2 className="text-2xl font-black">
              Admin audit log
            </h2>

            <div className="mt-6 space-y-3">
              {overview.recentAuditLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
                >
                  <p className="font-bold text-purple-300">
                    {log.action}
                  </p>
                  <p className="mt-2 text-xs text-zinc-600">
                    Target: {log.targetUserId ?? "broadcast/system"}
                  </p>
                  <p className="mt-2 text-[10px] text-zinc-700">
                    {formatDateTime(log.createdAt)}
                  </p>
                </div>
              ))}

              {overview.recentAuditLogs.length === 0 && (
                <p className="text-sm text-zinc-600">
                  No admin actions recorded yet.
                </p>
              )}
            </div>
          </article>
        </section>
      </div>

      {notificationOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-5 backdrop-blur-md"
          onClick={() => setNotificationOpen(false)}
        >
          <section
            className="w-full max-w-xl rounded-[34px] border border-white/10 bg-[#0b0b10] p-7 shadow-2xl sm:p-9"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs font-bold tracking-[0.2em] text-emerald-400">
              PUSH NOTIFICATION
            </p>

            <h2 className="mt-3 text-3xl font-black">
              {notificationTarget
                ? `Notify ${notificationTarget.fullName || notificationTarget.email || "user"}`
                : "Broadcast to all users"}
            </h2>

            <div className="mt-7 space-y-4">
              <input
                maxLength={80}
                value={notificationTitle}
                onChange={(event) =>
                  setNotificationTitle(event.target.value)
                }
                placeholder="Notification title"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none focus:border-emerald-500/40"
              />

              <textarea
                rows={4}
                maxLength={240}
                value={notificationBody}
                onChange={(event) =>
                  setNotificationBody(event.target.value)
                }
                placeholder="Write the notification message..."
                className="w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none focus:border-emerald-500/40"
              />

              <input
                maxLength={300}
                value={notificationUrl}
                onChange={(event) =>
                  setNotificationUrl(event.target.value)
                }
                placeholder="/dashboard"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none focus:border-emerald-500/40"
              />
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNotificationOpen(false)}
                className="rounded-2xl border border-white/[0.08] px-5 py-4 font-bold text-zinc-400"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={sendingNotification}
                onClick={() => void sendNotification()}
                className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-4 font-bold disabled:opacity-50"
              >
                {sendingNotification
                  ? "Sending..."
                  : "Send notification"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <article
      className={`rounded-3xl border p-6 ${
        accent
          ? "border-purple-500/20 bg-gradient-to-br from-purple-600/15 to-transparent"
          : "border-white/[0.07] bg-white/[0.025]"
      }`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/10 text-sm font-black text-purple-300">
        {icon}
      </div>
      <p className="mt-6 text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      <p className="mt-3 text-xs text-zinc-700">{helper}</p>
    </article>
  );
}

function StatusBadge({
  value,
  positive,
  danger = false,
}: {
  value: string;
  positive: boolean;
  danger?: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1.5 text-[10px] font-bold ${
        danger
          ? "border-red-500/20 bg-red-500/10 text-red-300"
          : positive
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
            : "border-white/[0.08] bg-white/[0.03] text-zinc-500"
      }`}
    >
      {value}
    </span>
  );
}
