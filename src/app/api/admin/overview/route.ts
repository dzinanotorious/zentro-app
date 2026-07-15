import { NextResponse } from "next/server";
import {
  requireAdmin,
  supabaseAdmin,
} from "@/lib/admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const { response } = await requireAdmin(request);

    if (response) return response;

    const today = todayUtc();

    const [
      authUsersResult,
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
      auditResult,
    ] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      }),

      supabaseAdmin
        .from("profiles")
        .select("id, is_admin, is_disabled"),

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
        .select("id, created_at")
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

      supabaseAdmin
        .from("admin_audit_logs")
        .select(
          "id, action, target_user_id, details, created_at",
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(12),
    ]);

    const errors = [
      authUsersResult.error,
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
      auditResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error("Admin overview errors:", errors);
      return NextResponse.json(
        { error: "Could not load complete admin data." },
        { status: 500 },
      );
    }

    const authUsers =
      authUsersResult.data.users ?? [];
    const profiles = profilesResult.data ?? [];
    const subscriptions =
      subscriptionsResult.data ?? [];
    const usage = usageResult.data ?? [];

    const activePro = subscriptions.filter(
      (item) =>
        item.plan_code === "pro" &&
        ["active", "trialing"].includes(item.status),
    );

    const monthlySubscribers = activePro.filter(
      (item) =>
        item.billing_period === "monthly",
    ).length;

    const yearlySubscribers = activePro.filter(
      (item) =>
        item.billing_period === "yearly",
    ).length;

    const estimatedMrrEur =
      monthlySubscribers * 9.99 +
      yearlySubscribers * (99.99 / 12);

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
      ...(recentSubscriptionsResult.data ?? []).map(
        (subscription) => ({
          id: `${subscription.user_id}-${subscription.updated_at}`,
          type: "subscription" as const,
          title: "Subscription updated",
          description: `${subscription.plan_code} · ${subscription.billing_period ?? "unknown"} · ${subscription.status}`,
          createdAt: subscription.updated_at,
        }),
      ),
      ...(auditResult.data ?? []).slice(0, 4).map(
        (log) => ({
          id: log.id,
          type: "admin" as const,
          title: "Admin action",
          description: log.action,
          createdAt: log.created_at,
        }),
      ),
    ]
      .filter((item) => Boolean(item.createdAt))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime(),
      )
      .slice(0, 12);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      totals: {
        users: authUsers.length,
        proUsers: activePro.length,
        disabledUsers: profiles.filter(
          (item) => item.is_disabled,
        ).length,
        admins: profiles.filter(
          (item) => item.is_admin,
        ).length,
        activeSubscriptions: subscriptions.filter(
          (item) =>
            ["active", "trialing"].includes(item.status),
        ).length,
        monthlySubscribers,
        yearlySubscribers,
        estimatedMrrEur:
          Math.round(estimatedMrrEur * 100) / 100,
        estimatedArrEur:
          Math.round(estimatedMrrEur * 1200) / 100,
        aiCoachMessagesToday: usage.reduce(
          (sum, item) =>
            sum +
            Number(item.coach_messages_used ?? 0),
          0,
        ),
        foodScansToday: usage.reduce(
          (sum, item) =>
            sum +
            Number(item.food_scans_used ?? 0),
          0,
        ),
        foodScansAllTime: scansResult.count ?? 0,
        pushSubscriptions: pushResult.count ?? 0,
        nutritionLogsToday:
          nutritionLogsResult.count ?? 0,
        conversationsAllTime:
          conversationsResult.count ?? 0,
      },
      recentActivity,
      recentAuditLogs: (auditResult.data ?? []).map(
        (log) => ({
          id: log.id,
          action: log.action,
          targetUserId: log.target_user_id,
          details: log.details ?? {},
          createdAt: log.created_at,
        }),
      ),
    });
  } catch (error) {
    console.error("Admin overview API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Admin overview failed.",
      },
      { status: 500 },
    );
  }
}
