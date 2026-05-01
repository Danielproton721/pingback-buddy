import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sendWebPush } from "../_shared/web-push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { userId, title, body, icon, url, vibrate, tag, paymentId } = await req.json();

  if (!userId) {
    return new Response(JSON.stringify({ error: "userId required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check user's notification settings
  const { data: settings } = await supabase
    .from("notification_settings")
    .select("push_enabled, vibration_enabled")
    .eq("user_id", userId)
    .single();

  if (settings && !settings.push_enabled) {
    return new Response(JSON.stringify({ skipped: true, reason: "push_disabled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get VAPID keys
  const { data: configs } = await supabase
    .from("system_config")
    .select("key, value")
    .in("key", ["vapid_public_key", "vapid_private_key_jwk"]);

  if (!configs || configs.length < 2) {
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const vapidPublicKey = configs.find((c: any) => c.key === "vapid_public_key")!.value;
  const vapidPrivateKeyJwk = configs.find((c: any) => c.key === "vapid_private_key_jwk")!.value;

  // Get all push subscriptions for this user
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

  if (!subscriptions || subscriptions.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const payload = {
    title: title || "PayHook",
    body: body || "Nova notificação",
    icon: icon || "/favicon.ico",
    url: url || "/",
    vibrate: settings?.vibration_enabled !== false,
    tag: tag || "payhook",
    paymentId,
  };

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      const response = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
        vapidPublicKey,
        vapidPrivateKeyJwk
      );

      if (response.status === 201 || response.status === 200) {
        sent++;
      } else if (response.status === 404 || response.status === 410) {
        // Subscription expired, remove it
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        failed++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return new Response(JSON.stringify({ sent, failed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
