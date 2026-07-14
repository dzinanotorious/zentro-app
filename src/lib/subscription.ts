import { supabase } from "./supabase";

export async function isProUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("plan_code, status")
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return false;
  }

  return (
    data.plan_code === "pro" &&
    (data.status === "active" ||
      data.status === "trialing")
  );
}
