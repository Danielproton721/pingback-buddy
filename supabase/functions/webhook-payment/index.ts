import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sendWebPush } from "../_shared/web-push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-gateway-name",
};

function extractField(payload: any, ...paths: string[]): any {
  for (const path of paths) {
    const parts = path.split(".");
    let val: any = payload;
    for (const p of parts) {
      const arrMatch = p.match(/^(.+)\[(\d+)\]$/);
      if (arrMatch) {
        val = val?.[arrMatch[1]]?.[Number(arrMatch[2])];
      } else {
        val = val?.[p];
      }
      if (val === undefined || val === null) break;
    }
    if (val !== undefined && val !== null) return val;
  }
  return null;
}

// Converte o valor bruto do gateway para reais.
// Gateways de pagamento enviam o valor na menor unidade (centavos) como número
// INTEIRO — ex.: 500 = R$ 5,00. Só quando vem com casa decimal ("5.00", "5,50")
// é que o valor já está em reais. Nunca use a magnitude ( >1000 ) pra decidir:
// isso fazia toda compra abaixo de ~R$ 10 virar 100x maior.
function parseAmount(raw: any): number {
  if (raw === null || raw === undefined || raw === "") return 0;
  const n = Number(String(raw).replace(",", "."));
  if (!isFinite(n) || n <= 0) return 0;
  const hasDecimal = /[.,]/.test(String(raw));
  return hasDecimal ? n : n / 100;
}

function parseEventTime(payload: any): string | null {
  const raw = extractField(
    payload,
    "data.createdAt", "data.paidAt", "data.updatedAt",
    "created_at", "paid_at", "updated_at", "event_time",
    "data.object.created", "data.object.paid_at",
    "transaction.created_at", "transaction.date_created"
  );
  if (!raw) return null;
  try {
    // Unix timestamp (seconds)
    if (typeof raw === "number") {
      const ts = raw > 1e12 ? raw : raw * 1000;
      return new Date(ts).toISOString();
    }
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  
  // Support gateway identification via query param, header, or payload
  const url = new URL(req.url);
  const gatewayParam = url.searchParams.get("gateway");
  const gatewayHeader = req.headers.get("x-gateway-name");
  const gatewayName = gatewayParam || gatewayHeader || "unknown";
  const webhookSecret = req.headers.get("x-webhook-secret") || "";

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("Webhook received - raw_payload:", JSON.stringify(payload));

  // Validate secret against gateway configs
  const { data: configs } = await supabase
    .from("gateway_configs")
    .select("user_id, secret_key, name")
    .eq("is_active", true);

  const matchedConfig = configs?.find(
    (c: any) => c.secret_key === webhookSecret || c.name.toLowerCase() === gatewayName.toLowerCase()
  );

  if (!matchedConfig && webhookSecret) {
    const secretMatch = configs?.find((c: any) => c.secret_key === webhookSecret);
    if (!secretMatch) {
      await supabase.from("webhook_logs").insert({
        user_id: configs?.[0]?.user_id || "00000000-0000-0000-0000-000000000000",
        payload,
        status: "error",
        ip_address: ip,
        error_message: "Invalid webhook secret",
        gateway: gatewayName,
      });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const userId = matchedConfig?.user_id || configs?.[0]?.user_id;
  if (!userId) {
    return new Response(JSON.stringify({ error: "No gateway configured" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- Robust field extraction with fallbacks ---
  const eventType = extractField(payload, "event", "type", "event_type", "action") || "unknown";
  const dataStatus = extractField(payload, "data.status", "data.object.status");
  const transactionId = extractField(
    payload, "id", "transaction_id", "payment_id", "charge_id",
    "data.object.id", "data.id", "transaction.id"
  ) || crypto.randomUUID();

  const statusMap: Record<string, string> = {
    payment_created: "pending", payment_paid: "paid", payment_confirmed: "paid",
    payment_failed: "failed", payment_declined: "failed", payment_refunded: "refunded",
    payment_cancelled: "cancelled", refund: "refunded", chargeback: "chargeback",
    charge_succeeded: "paid", charge_failed: "failed",
    "charge.succeeded": "paid", "charge.failed": "failed",
    "payment_intent.succeeded": "paid", "payment_intent.payment_failed": "failed",
    approved: "paid", refused: "failed", refunded: "refunded",
    waiting_payment: "pending", pending: "pending", paid: "paid",
  };
  // Prioritize data.status over event type for status mapping
  const status = statusMap[dataStatus] || statusMap[eventType] || "pending";

  const rawAmount = extractField(
    payload, "amount", "data.amount", "data.object.amount", "value",
    "transaction.amount", "transaction.paid_amount",
    "data.object.amount_total", "data.paidAmount"
  );
  const amount = parseAmount(rawAmount);

  const customerName = extractField(
    payload, "customer_name", "data.customer.name", "data.object.customer_name",
    "customer.name", "payer.name", "buyer.name",
    "data.object.billing_details.name", "transaction.customer.name"
  );

  const customerEmail = extractField(
    payload, "customer_email", "data.customer.email", "data.object.customer_email",
    "customer.email", "email", "payer.email", "buyer.email",
    "data.object.receipt_email", "transaction.customer.email"
  );

  const paymentMethod = extractField(
    payload, "payment_method", "data.paymentMethod", "data.object.payment_method_types[0]",
    "method", "payment_type", "data.object.payment_method",
    "transaction.payment_method"
  );

  const productName = extractField(
    payload, "product_name", "data.items[0].title", "data.items[0].name",
    "items[0].name", "items[0].title", "data.object.description",
    "description", "product.name", "data.object.metadata.product_name",
    "data.metadata.description", "line_items[0].description",
    "transaction.items[0].title", "offer.name"
  );

  const eventTime = parseEventTime(payload);

  // Log extraction results
  const missingFields: string[] = [];
  if (!rawAmount) missingFields.push("amount");
  if (!customerName) missingFields.push("customer_name");
  if (!customerEmail) missingFields.push("customer_email");
  if (!productName) missingFields.push("product_name");
  if (!eventTime) missingFields.push("event_time");
  if (!paymentMethod) missingFields.push("payment_method");

  if (missingFields.length > 0) {
    console.warn(`Webhook parsing: missing fields [${missingFields.join(", ")}] from payload keys: [${Object.keys(payload).join(", ")}]`);
  }

  const processingTimeMs = Date.now() - startTime;

  try {
    // --- Dedup: check for existing payment with same amount within 5 min window ---
    let paymentData: { id: string } | null = null;

    if (amount > 0 && eventTime) {
      const eventDate = new Date(eventTime);
      const windowStart = new Date(eventDate.getTime() - 5 * 60 * 1000).toISOString();
      const windowEnd = new Date(eventDate.getTime() + 5 * 60 * 1000).toISOString();

      const { data: existing } = await supabase
        .from("payments")
        .select("id, status")
        .eq("user_id", userId)
        .eq("amount", amount)
        .gte("event_time", windowStart)
        .lte("event_time", windowEnd)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (existing && existing.status === "pending" && status === "paid") {
        // Update existing pending payment to paid
        const { error: updateError } = await supabase
          .from("payments")
          .update({
            status,
            transaction_id: String(transactionId),
            customer_name: customerName || undefined,
            customer_email: customerEmail || undefined,
            payment_method: paymentMethod || undefined,
            raw_payload: payload,
            event_type: eventType,
            event_time: eventTime,
            product_name: productName || undefined,
          })
          .eq("id", existing.id);

        if (updateError) throw updateError;
        paymentData = { id: existing.id };
        console.log(`Dedup: updated existing pending payment ${existing.id} to paid`);
      }
    }

    // If no dedup match, insert new payment
    if (!paymentData) {
      const { data: inserted, error: paymentError } = await supabase.from("payments").insert({
        user_id: userId,
        transaction_id: String(transactionId),
        status,
        amount,
        customer_name: customerName,
        customer_email: customerEmail,
        payment_method: paymentMethod,
        gateway: matchedConfig?.name || gatewayName,
        raw_payload: payload,
        event_type: eventType,
        product_name: productName,
        event_time: eventTime,
      }).select("id").single();

      if (paymentError) throw paymentError;
      paymentData = inserted;
    }

    await supabase.from("webhook_logs").insert({
      user_id: userId,
      payload: {
        ...payload,
        _meta: {
          processing_time_ms: processingTimeMs,
          missing_fields: missingFields,
          mapped_fields: {
            amount, customer_name: customerName, customer_email: customerEmail,
            product_name: productName, event_time: eventTime, payment_method: paymentMethod,
            status, event_type: eventType, transaction_id: transactionId,
          },
        },
      },
      status: "processed",
      ip_address: ip,
      gateway: matchedConfig?.name || gatewayName,
    });

    // Notification - fetch user's custom templates
    const { data: userSettings } = await supabase
      .from("notification_settings")
      .select("paid_title, paid_message, pending_title, pending_message, paid_enabled, pending_enabled")
      .eq("user_id", userId)
      .single();

    const us = userSettings as any;
    const statusLabels: Record<string, string> = {
      paid: us?.paid_title || "Pagamento confirmado",
      pending: us?.pending_title || "Novo pagamento",
      failed: "Pagamento recusado", refunded: "Estorno realizado",
      chargeback: "Chargeback recebido", cancelled: "Pagamento cancelado",
    };
    const notifTitle = statusLabels[status] || "Atualização de pagamento";

    // Use custom message template if available
    const templateMsg = status === "paid" ? us?.paid_message : status === "pending" ? us?.pending_message : null;
    const formatTemplate = (tpl: string) =>
      tpl
        .replace(/\{customer\}/g, customerName || "Cliente")
        .replace(/\{amount\}/g, Number(amount).toFixed(2))
        .replace(/\{product\}/g, productName || "N/A")
        .replace(/\{method\}/g, paymentMethod || "N/A");

    const notifMessage = templateMsg
      ? formatTemplate(templateMsg)
      : `${customerName || "Cliente"} - R$ ${Number(amount).toFixed(2)}${productName ? ` - ${productName}` : ""} via ${paymentMethod || "N/A"}`;

    // Liga/desliga a notificação por status (Pago / Pendente). Outros status sempre notificam.
    const notifyEnabled =
      status === "paid" ? us?.paid_enabled !== false
      : status === "pending" ? us?.pending_enabled !== false
      : true;

    if (notifyEnabled) {
    await supabase.from("notifications").insert({
      user_id: userId,
      title: notifTitle,
      message: notifMessage,
      type: "payment",
      payment_id: paymentData?.id,
    });

    // Send push notifications
    try {
      const { data: vapidConfigs } = await supabase
        .from("system_config")
        .select("key, value")
        .in("key", ["vapid_public_key", "vapid_private_key_jwk"]);

      if (vapidConfigs && vapidConfigs.length === 2) {
        const vapidPublicKey = vapidConfigs.find((c: any) => c.key === "vapid_public_key")!.value;
        const vapidPrivateKeyJwk = vapidConfigs.find((c: any) => c.key === "vapid_private_key_jwk")!.value;

        const { data: settings } = await supabase
          .from("notification_settings")
          .select("push_enabled, vibration_enabled")
          .eq("user_id", userId)
          .single();

        if (!settings || settings.push_enabled !== false) {
          const { data: subscriptions } = await supabase
            .from("push_subscriptions")
            .select("*")
            .eq("user_id", userId);

          if (subscriptions && subscriptions.length > 0) {
            const pushPayload = {
              title: notifTitle,
              body: notifMessage,
              icon: "/favicon.ico",
              url: "/",
              vibrate: settings?.vibration_enabled !== false,
              tag: `payment-${paymentData?.id}`,
              paymentId: paymentData?.id,
            };
            for (const sub of subscriptions) {
              try {
                const resp = await sendWebPush(
                  { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
                  pushPayload, vapidPublicKey, vapidPrivateKeyJwk
                );
                if (resp.status === 404 || resp.status === 410) {
                  await supabase.from("push_subscriptions").delete().eq("id", sub.id);
                }
              } catch { /* Push failed, continue */ }
            }
          }
        }
      }
    } catch { /* Push notification errors shouldn't fail the webhook */ }
    }

    return new Response(JSON.stringify({ success: true, processing_time_ms: processingTimeMs }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook processing error:", String(error));
    await supabase.from("webhook_logs").insert({
      user_id: userId,
      payload: { ...payload, _meta: { processing_time_ms: Date.now() - startTime, error: String(error) } },
      status: "error",
      ip_address: ip,
      error_message: String(error),
      gateway: matchedConfig?.name || gatewayName,
    });
    // Always return 200 to prevent gateway retries
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
