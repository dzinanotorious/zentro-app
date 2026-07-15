import webPush from "web-push";
import { NextResponse } from "next/server";
import {
  requireAdmin,
  supabaseAdmin,
  writeAuditLog,
} from "@/lib/admin-server";

export const runtime = "nodejs";

const vapidPublicKey =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey =
  process.env.VAPID_PRIVATE_KEY;
const vapidSubject =
  process.env.VAPID_SUBJECT;

if (
  vapidPublicKey &&
  vapidPrivateKey &&
  vapidSubject
) {
  webPush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey,
  );
}

type SendRequest = {
  targetUserId?: string | null;
  title?: string;
  body?: string;
  url?: string;
};

export async function POST(request: Request) {
  try {
    const { user: admin, response } =
      await requireAdmin(request);

    if (response || !admin) {
      return response;
    }

    if (
      !vapidPublicKey ||
      !vapidPrivateKey ||
      !vapidSubject
    ) {
      return NextResponse.json(
        {
          error:
            "VAPID environment variables are missing.",
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as SendRequest;

    const title = body.title?.trim() || "Zentro";
    const notificationBody = body.body?.trim();
    const targetUserId =
      body.targetUserId?.trim() || null;
    const url = body.url?.trim() || "/dashboard";

    if (!notificationBody) {
      return NextResponse.json(
        { error: "Notification body is required." },
        { status: 400 },
      );
    }

    if (
      title.length > 80 ||
      notificationBody.length > 240 ||
      url.length > 300
    ) {
      return NextResponse.json(
        { error: "Notification data is too long." },
        { status: 400 },
      );
    }

    if (!url.startsWith("/")) {
      return NextResponse.json(
        {
          error:
            "Notification URL must be an internal path.",
        },
        { status: 400 },
      );
    }

    let query = supabaseAdmin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth");

    if (targetUserId) {
      query = query.eq("user_id", targetUserId);
    }

    const { data: subscriptions, error } =
      await query;

    if (error) throw error;

    const payload = JSON.stringify({
      title,
      body: notificationBody,
      url,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: targetUserId
        ? `zentro-admin-${targetUserId}`
        : "zentro-admin-broadcast",
    });

    let sent = 0;
    let failed = 0;
    let removedExpired = 0;

    await Promise.all(
      (subscriptions ?? []).map(
        async (subscription) => {
          try {
            await webPush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: {
                  p256dh: subscription.p256dh,
                  auth: subscription.auth,
                },
              },
              payload,
            );

            sent += 1;
          } catch (sendError) {
            failed += 1;

            const statusCode =
              typeof sendError === "object" &&
              sendError !== null &&
              "statusCode" in sendError
                ? Number(sendError.statusCode)
                : 0;

            if (
              statusCode === 404 ||
              statusCode === 410
            ) {
              const { error: deleteError } =
                await supabaseAdmin
                  .from("push_subscriptions")
                  .delete()
                  .eq("id", subscription.id);

              if (!deleteError) {
                removedExpired += 1;
              }
            } else {
              console.error(
                "Push notification error:",
                sendError,
              );
            }
          }
        },
      ),
    );

    await writeAuditLog({
      adminUserId: admin.id,
      targetUserId,
      action: targetUserId
        ? "send_user_notification"
        : "send_broadcast_notification",
      details: {
        title,
        body: notificationBody,
        url,
        sent,
        failed,
        removedExpired,
      },
    });

    return NextResponse.json({
      success: true,
      sent,
      failed,
      removedExpired,
    });
  } catch (error) {
    console.error(
      "Admin notification send error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not send notification.",
      },
      { status: 500 },
    );
  }
}
