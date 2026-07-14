import Stripe from "stripe";
import { NextResponse } from "next/server";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error(
    "Missing STRIPE_SECRET_KEY in .env.local",
  );
}

const stripe = new Stripe(stripeSecretKey);

type CheckoutRequest = {
  billingCycle?: "monthly" | "yearly";
  userId?: string;
  userEmail?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckoutRequest;

    const billingCycle = body.billingCycle;

    if (
      billingCycle !== "monthly" &&
      billingCycle !== "yearly"
    ) {
      return NextResponse.json(
        {
          error: "Invalid billing cycle.",
        },
        {
          status: 400,
        },
      );
    }

    const priceId =
      billingCycle === "monthly"
        ? process.env.STRIPE_MONTHLY_PRICE_ID
        : process.env.STRIPE_YEARLY_PRICE_ID;

    if (!priceId) {
      return NextResponse.json(
        {
          error: `Missing Stripe ${billingCycle} Price ID.`,
        },
        {
          status: 500,
        },
      );
    }

    const origin =
      request.headers.get("origin") ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout`,

      customer_email: body.userEmail || undefined,

      client_reference_id: body.userId || undefined,

      metadata: {
        user_id: body.userId ?? "",
        billing_cycle: billingCycle,
      },

      subscription_data: {
        metadata: {
          user_id: body.userId ?? "",
          billing_cycle: billingCycle,
        },
      },

      allow_promotion_codes: true,
    });

    if (!session.url) {
      return NextResponse.json(
        {
          error: "Stripe did not return a checkout URL.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    console.error("Stripe Checkout error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create Stripe Checkout session.",
      },
      {
        status: 500,
      },
    );
  }
}
    