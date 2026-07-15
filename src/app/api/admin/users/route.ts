import { NextResponse } from "next/server";
import {
  requireAdmin,
  supabaseAdmin,
} from "@/lib/admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Filter =
  | "all"
  | "pro"
  | "free"
  | "admin"
  | "disabled";

export async function GET(request: Request) {
  try {
    const { response } = await requireAdmin(request);

    if (response) return response;

    const url = new URL(request.url);
    const page = Math.max(
      1,
      Number(url.searchParams.get("page") ?? 1),
    );
    const perPage = Math.min(
      50,
      Math.max(
        5,
        Number(url.searchParams.get("perPage") ?? 20),
      ),
    );
    const search = (
      url.searchParams.get("search") ?? ""
    )
      .trim()
      .toLowerCase();
    const filter = (
      url.searchParams.get("filter") ?? "all"
    ) as Filter;

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (authError) {
      throw authError;
    }

    const authUsers = authData.users ?? [];
    const userIds = authUsers.map((user) => user.id);
    const today = new Date().toISOString().slice(0, 10);

    const [
      profilesResult,
      subscriptionsResult,
      usageResult,
      pushResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          "id, full_name, is_admin, is_disabled",
        )
        .in(
          "id",
          userIds.length > 0
            ? userIds
            : ["00000000-0000-0000-0000-000000000000"],
        ),

      supabaseAdmin
        .from("user_subscriptions")
        .select(
          "user_id, plan_code, status, billing_period",
        )
        .in(
          "user_id",
          userIds.length > 0
            ? userIds
            : ["00000000-0000-0000-0000-000000000000"],
        ),

      supabaseAdmin
        .from("user_ai_usage")
        .select(
          "user_id, coach_messages_used, food_scans_used",
        )
        .eq("date", today),

      supabaseAdmin
        .from("push_subscriptions")
        .select("user_id"),
    ]);

    const errors = [
      profilesResult.error,
      subscriptionsResult.error,
      usageResult.error,
      pushResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error("Admin users query errors:", errors);
      return NextResponse.json(
        { error: "Could not load users." },
        { status: 500 },
      );
    }

    const profileMap = new Map(
      (profilesResult.data ?? []).map((item) => [
        item.id,
        item,
      ]),
    );

    const subscriptionMap = new Map(
      (subscriptionsResult.data ?? []).map((item) => [
        item.user_id,
        item,
      ]),
    );

    const usageMap = new Map(
      (usageResult.data ?? []).map((item) => [
        item.user_id,
        item,
      ]),
    );

    const pushCounts = new Map<string, number>();

    for (const item of pushResult.data ?? []) {
      pushCounts.set(
        item.user_id,
        (pushCounts.get(item.user_id) ?? 0) + 1,
      );
    }

    let users = authUsers.map((authUser) => {
      const profile = profileMap.get(authUser.id);
      const subscription =
        subscriptionMap.get(authUser.id);
      const usage = usageMap.get(authUser.id);

      const activePro =
        subscription?.plan_code === "pro" &&
        ["active", "trialing"].includes(
          subscription.status,
        );

      return {
        id: authUser.id,
        email: authUser.email ?? null,
        fullName: profile?.full_name ?? null,
        createdAt: authUser.created_at ?? null,
        lastSignInAt:
          authUser.last_sign_in_at ?? null,
        isAdmin: Boolean(profile?.is_admin),
        isDisabled: Boolean(profile?.is_disabled),
        planCode: activePro
          ? ("pro" as const)
          : ("free" as const),
        subscriptionStatus:
          subscription?.status ?? "inactive",
        billingPeriod:
          subscription?.billing_period ?? null,
        aiCoachMessagesToday: Number(
          usage?.coach_messages_used ?? 0,
        ),
        foodScansToday: Number(
          usage?.food_scans_used ?? 0,
        ),
        pushSubscriptions:
          pushCounts.get(authUser.id) ?? 0,
      };
    });

    if (search) {
      users = users.filter((user) =>
        [user.email, user.fullName]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(search),
          ),
      );
    }

    if (filter === "pro") {
      users = users.filter(
        (user) => user.planCode === "pro",
      );
    } else if (filter === "free") {
      users = users.filter(
        (user) => user.planCode === "free",
      );
    } else if (filter === "admin") {
      users = users.filter((user) => user.isAdmin);
    } else if (filter === "disabled") {
      users = users.filter(
        (user) => user.isDisabled,
      );
    }

    users.sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime(),
    );

    const total = users.length;
    const totalPages = Math.max(
      1,
      Math.ceil(total / perPage),
    );
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * perPage;

    return NextResponse.json({
      users: users.slice(start, start + perPage),
      page: safePage,
      perPage,
      total,
      totalPages,
    });
  } catch (error) {
    console.error("Admin users API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load users.",
      },
      { status: 500 },
    );
  }
}
