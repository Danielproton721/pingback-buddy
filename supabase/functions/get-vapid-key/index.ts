import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateVapidKeys } from "../_shared/web-push.ts";

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

  // Check if VAPID keys exist
  const { data: existing } = await supabase
    .from("system_config")
    .select("key, value")
    .in("key", ["vapid_public_key", "vapid_private_key_jwk"]);

  let publicKey: string;

  if (existing && existing.length === 2) {
    publicKey = existing.find((r: any) => r.key === "vapid_public_key")!.value;
  } else {
    // Generate new VAPID keys
    const keys = await generateVapidKeys();
    publicKey = keys.publicKey;

    await supabase.from("system_config").upsert([
      { key: "vapid_public_key", value: keys.publicKey },
      { key: "vapid_private_key_jwk", value: keys.privateKeyJwk },
    ]);
  }

  return new Response(JSON.stringify({ publicKey }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
