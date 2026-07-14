import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!serviceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

const stripe = new Stripe(stripeSecretKey);

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

function timestampToIso(timestamp: number | null | undefined) {
  if (!timestamp) {
    return null;
  }

  return new Date(timestamp * 1000).toISOString();
}

function getBillingPeriod(
  subscription: Stripe.Subscription,
): "monthly" | "yearly" | null {
  const interval =
    subscription.items.data[0]?.price.recurring?.interval;

  if (interval === "month") {
    return "monthly";
  }

  if (interval === "year") {
    return "yearly";
  }

  return null;
}

function getCustomerId(subscription: Stripe.Subscription) {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
}

export async function POST(request: Request) {
  if (!webhookSecret) {
    return NextResponse.json(
      {
        error: "Missing STRIPE_WEBHOOK_SECRET",
      },
      {
        status: 500,
      },
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      {
        error: "Missing Stripe signature",
      },
      {
        status: 400,
      },
    );
  }

  const rawBody = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch (error) {
    console.error("Webhook signature error:", error);

    return NextResponse.json(
      {
        error: "Invalid webhook signature",
      },
      {
        status: 400,
      },
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session =
        event.data.object as Stripe.Checkout.Session;

      const userId =
        session.client_reference_id ||
        session.metadata?.user_id;

      if (!userId) {
        throw new Error(
          "Stripe session does not contain a user ID.",
        );
      }

      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id;

      let currentPeriodStart: string | null = null;
      let currentPeriodEnd: string | null = null;
      let billingPeriod: "monthly" | "yearly" | null = null;

      if (subscriptionId) {
        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);

        const subscriptionItem = subscription.items.data[0];

        currentPeriodStart = timestampToIso(
          subscriptionItem?.current_period_start,
        );

        currentPeriodEnd = timestampToIso(
          subscriptionItem?.current_period_end,
        );

        billingPeriod = getBillingPeriod(subscription);
      }

      const { error } = await supabaseAdmin
        .from("user_subscriptions")
        .upsert(
          {
            user_id: userId,
            plan_code: "pro",
            status: "active",
            billing_period:
              billingPeriod ||
              session.metadata?.billing_cycle ||
              null,
            stripe_customer_id: customerId || null,
            stripe_subscription_id: subscriptionId || null,
            current_period_start: currentPeriodStart,
            current_period_end: currentPeriodEnd,
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          },
        );

      if (error) {
        throw error;
      }
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription =
        event.data.object as Stripe.Subscription;

      const userId = subscription.metadata?.user_id;

      if (!userId) {
        console.warn(
          "Subscription webhook has no user_id metadata.",
        );

        return NextResponse.json({
          received: true,
        });
      }

      const activeStatuses = ["active", "trialing"];
      const isActive = activeStatuses.includes(
        subscription.status,
      );

      const subscriptionItem = subscription.items.data[0];

      const { error } = await supabaseAdmin
        .from("user_subscriptions")
        .upsert(
          {
            user_id: userId,
            plan_code: isActive ? "pro" : "free",
            status: isActive
              ? subscription.status
              : "canceled",
            billing_period: getBillingPeriod(subscription),
            stripe_customer_id: getCustomerId(subscription),
            stripe_subscription_id: subscription.id,
            current_period_start: timestampToIso(
              subscriptionItem?.current_period_start,
            ),
            current_period_end: timestampToIso(
              subscriptionItem?.current_period_end,
            ),
            cancel_at_period_end:
              subscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          },
        );

      if (error) {
        throw error;
      }
    }

    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    console.error("Stripe webhook processing error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Webhook processing failed.",
      },
      {
        status: 500,
      },
    );
  }
}
