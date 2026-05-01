import { useState, useEffect, useRef } from "react";
import { Bell, Check, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/supabase-helpers";
import type { Notification } from "@/lib/supabase-helpers";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundUrl, setSoundUrl] = useState<string>("default");
  const [soundVolume, setSoundVolume] = useState(0.7);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const loadPrefs = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("notification_settings")
          .select("sound_enabled, notification_sound, notification_volume")
          .eq("user_id", user.id)
          .single();
        if (data) {
          const d = data as any;
          setSoundEnabled(d.sound_enabled ?? false);
          setSoundUrl(d.notification_sound ?? "default");
          setSoundVolume(d.notification_volume ?? 0.7);
        }
      }
    };
    loadPrefs();
  }, []);

  const playSound = () => {
    const src = soundUrl === "default"
      ? "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
      : soundUrl;
    const audio = new Audio(src);
    audio.volume = soundVolume;
    audio.play().catch(() => {});
  };

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setNotifications(data as unknown as Notification[]);
    };
    load();

    const channel = supabase
      .channel("notifications-bell")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        const newNotif = payload.new as unknown as Notification;
        setNotifications((prev) => [newNotif, ...prev].slice(0, 20));
        if (soundEnabled) playSound();
        if (Notification.permission === "granted") {
          new Notification(newNotif.title, { body: newNotif.message || "", icon: "/favicon.ico" });
        }
        if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [soundEnabled, soundUrl, soundVolume]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[calc(100vw-2rem)] max-w-80 overflow-hidden rounded-xl border border-border bg-card shadow-xl animate-slide-in">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Notificações</h3>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-xs text-primary hover:underline">
                  Marcar todas como lidas
                </button>
              )}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma notificação</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 border-b border-border/50 px-4 py-3 transition-colors ${!n.read ? "bg-primary/5" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    {n.message && <p className="text-xs text-muted-foreground truncate">{n.message}</p>}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  {!n.read && (
                    <button onClick={() => handleMarkRead(n.id)} className="mt-1 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                      <Check className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
