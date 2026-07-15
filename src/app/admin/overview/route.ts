import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL",
  );
}

if (!serviceRoleKey) {
  throw new Error(
    "Missing SUPABASE_SERVICE_ROLE_KEY",
  );
}

const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

function getLocalDateString(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0");
  const day = String(
    date.getUTCDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getBearerToken(request: Request) {
  return request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
}

export async function GET(request: Request) {
  try {
    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "Missing authorization token.",
        },
        {
          status: 401,
        },
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(
      accessToken,
    );

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            "Your login session is invalid or expired.",
        },
        {
          status: 401,
        },
      );
    }

    const {
      data: adminProfile,
      error: adminError,
    } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (
      adminError ||
      !adminProfile?.is_admin
    ) {
      return NextResponse.json(
        {
          error: "Admin access required.",
        },
        {
          status: 403,
        },
      );
    }

    const today = getLocalDateString(
      new Date(),
    );

    const [
      profilesResult,
      subscriptionsResult,
      usageResult,
      pushResult,
      scansResult,
      nutritionLogsResult,
      conversationsResult,
      recentScansResult,
      recentMessagesResult,
      recentSubscriptionsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          "id, email, full_name, created_at, is_admin",
        )
        .order("created_at", {
          ascending: false,
        }),

      supabaseAdmin
        .from("user_subscriptions")
        .select(
          "user_id, plan_code, status, billing_period, updated_at",
        ),

      supabaseAdmin
        .from("user_ai_usage")
        .select(
          "coach_messages_used, food_scans_used",
        )
        .eq("date", today),

      supabaseAdmin
        .from("push_subscriptions")
        .select("id", {
          count: "exact",
          head: true,
        }),

      supabaseAdmin
        .from("food_scan_history")
        .select("id", {
          count: "exact",
          head: true,
        }),

      supabaseAdmin
        .from("nutrition_logs")
        .select("user_id", {
          count: "exact",
          head: true,
        })
        .eq("log_date", today),

      supabaseAdmin
        .from("coach_conversations")
        .select("id", {
          count: "exact",
          head: true,
        }),

      supabaseAdmin
        .from("food_scan_history")
        .select(
          "id, meal_name, total_calories, scanned_at",
        )
        .order("scanned_at", {
          ascending: false,
        })
        .limit(6),

      supabaseAdmin
        .from("coach_messages")
        .select(
          "id, role, created_at",
        )
        .eq("role", "user")
        .order("created_at", {
          ascending: false,
        })
        .limit(6),

      supabaseAdmin
        .from("user_subscriptions")
        .select(
          "user_id, plan_code, status, billing_period, updated_at",
        )
        .order("updated_at", {
          ascending: false,
        })
        .limit(6),
    ]);

    const queryErrors = [
      profilesResult.error,
      subscriptionsResult.error,
      usageResult.error,
      pushResult.error,
      scansResult.error,
      nutritionLogsResult.error,
      conversationsResult.error,
      recentScansResult.error,
      recentMessagesResult.error,
      recentSubscriptionsResult.error,
    ].filter(Boolean);

    if (queryErrors.length > 0) {
      console.error(
        "Admin overview query errors:",
        queryErrors,
      );

      return NextResponse.json(
        {
          error:
            "Could not load complete admin data.",
        },
        {
          status: 500,
        },
      );
    }

    const profiles =
      profilesResult.data ?? [];

    const subscriptions =
      subscriptionsResult.data ?? [];

    const todayUsage =
      usageResult.data ?? [];

    const subscriptionByUser = new Map(
      subscriptions.map((subscription) => [
        subscription.user_id,
        subscription,
      ]),
    );

    const activeSubscriptions =
      subscriptions.filter((subscription) =>
        ["active", "trialing"].includes(
          subscription.status,
        ),
      );

    const activeProSubscriptions =
      activeSubscriptions.filter(
        (subscription) =>
          subscription.plan_code === "pro",
      );

    const monthlySubscribers =
      activeProSubscriptions.filter(
        (subscription) =>
          subscription.billing_period ===
          "monthly",
      ).length;

    const yearlySubscribers =
      activeProSubscriptions.filter(
        (subscription) =>
          subscription.billing_period ===
          "yearly",
      ).length;

    const estimatedMrrEur =
      monthlySubscribers * 9.99 +
      yearlySubscribers * (99.99 / 12);

    const estimatedArrEur =
      estimatedMrrEur * 12;

    const aiCoachMessagesToday =
      todayUsage.reduce(
        (sum, item) =>
          sum +
          Number(
            item.coach_messages_used ?? 0,
          ),
        0,
      );

    const foodScansToday =
      todayUsage.reduce(
        (sum, item) =>
          sum +
          Number(item.food_scans_used ?? 0),
        0,
      );

    const recentUsers = profiles
      .slice(0, 20)
      .map((profile) => {
        const subscription =
          subscriptionByUser.get(profile.id);

        return {
          id: profile.id,
          email: profile.email ?? null,
          fullName:
            profile.full_name ?? null,
          createdAt:
            profile.created_at ?? null,
          isAdmin:
            Boolean(profile.is_admin),
          planCode:
            subscription?.plan_code ??
            "free",
          subscriptionStatus:
            subscription?.status ??
            "inactive",
        };
      });

    const recentActivity = [
      ...(recentScansResult.data ?? []).map(
        (scan) => ({
          id: scan.id,
          type: "food_scan" as const,
          title: "Food scan completed",
          description: `${scan.meal_name} · ${Math.round(
            Number(scan.total_calories ?? 0),
          )} kcal`,
          createdAt: scan.scanned_at,
        }),
      ),

      ...(recentMessagesResult.data ?? []).map(
        (message) => ({
          id: message.id,
          type: "coach" as const,
          title: "AI Coach message",
          description:
            "A user sent a new coaching request.",
          createdAt: message.created_at,
        }),
      ),

      ...(recentSubscriptionsResult.data ??
        []).map((subscription) => ({
        id: `${subscription.user_id}-${subscription.updated_at}`,
        type: "subscription" as const,
        title:
          subscription.status === "active"
            ? "Active subscription"
            : "Subscription updated",
        description: `${subscription.plan_code} · ${subscription.billing_period ?? "unknown"} · ${subscription.status}`,
        createdAt: subscription.updated_at,
      })),
    ]
      .filter(
        (activity) =>
          Boolean(activity.createdAt),
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime(),
      )
      .slice(0, 12);

    return NextResponse.json({
      generatedAt:
        new Date().toISOString(),
      totals: {
        users: profiles.length,
        proUsers:
          activeProSubscriptions.length,
        freeUsers: Math.max(
          profiles.length -
            activeProSubscriptions.length,
          0,
        ),
        activeSubscriptions:
          activeSubscriptions.length,
        monthlySubscribers,
        yearlySubscribers,
        estimatedMrrEur:
          Math.round(
            estimatedMrrEur * 100,
          ) / 100,
        estimatedArrEur:
          Math.round(
            estimatedArrEur * 100,
          ) / 100,
        aiCoachMessagesToday,
        foodScansToday,
        foodScansAllTime:
          scansResult.count ?? 0,
        pushSubscriptions:
          pushResult.count ?? 0,
        nutritionLogsToday:
          nutritionLogsResult.count ?? 0,
        conversationsAllTime:
          conversationsResult.count ?? 0,
      },
      recentUsers,
      recentActivity,
    });
  } catch (error) {
    console.error(
      "Admin overview API error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Admin overview failed.",
      },
      {
        status: 500,
      },
    );
  }
}
