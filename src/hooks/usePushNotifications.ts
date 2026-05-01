import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

export function usePushNotifications() {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PermissionState);
    checkExistingSubscription();
  }, []);

  const checkExistingSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      if (registration) {
        const sub = await (registration as any).pushManager?.getSubscription();
        setIsSubscribed(!!sub);
      }
    } catch {
      // SW not registered yet
    }
  };

  const getVapidKey = async (): Promise<string> => {
    if (vapidPublicKey) return vapidPublicKey;
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-vapid-key`,
      {
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      }
    );
    const { publicKey } = await response.json();
    setVapidPublicKey(publicKey);
    return publicKey;
  };

  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  };

  const subscribe = useCallback(async () => {
    if (permission === "unsupported") return false;
    setLoading(true);

    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
      if (result !== "granted") {
        setLoading(false);
        return false;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const publicKey = await getVapidKey();
      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      const pushManager = (registration as any).pushManager;
      const subscription = await pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const json = subscription.toJSON();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await supabase.from("push_subscriptions").insert({
        user_id: user.id,
        endpoint: json.endpoint!,
        p256dh: json.keys!.p256dh!,
        auth: json.keys!.auth!,
      } as any);

      await supabase.from("notification_settings").upsert(
        { user_id: user.id, push_enabled: true } as any,
        { onConflict: "user_id" }
      );

      setIsSubscribed(true);
      setLoading(false);
      return true;
    } catch (error) {
      console.error("Push subscription failed:", error);
      setLoading(false);
      return false;
    }
  }, [permission, vapidPublicKey]);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      if (registration) {
        const pushManager = (registration as any).pushManager;
        const sub = await pushManager?.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
        }
      }
      setIsSubscribed(false);
    } catch (error) {
      console.error("Unsubscribe failed:", error);
    }
    setLoading(false);
  }, []);

  return { permission, isSubscribed, loading, subscribe, unsubscribe };
}
