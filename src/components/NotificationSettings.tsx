import { useState, useEffect, useRef } from "react";
import { Bell, BellOff, Volume2, VolumeX, Vibrate, Send, Upload, Play, Music } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";

interface Settings {
  push_enabled: boolean;
  sound_enabled: boolean;
  vibration_enabled: boolean;
  notification_sound: string;
  notification_volume: number;
}

function SettingRow({
  icon: Icon, label, description, enabled, onToggle, disabled,
}: {
  icon: any; label: string; description: string; enabled: boolean; onToggle: () => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
          enabled ? "bg-primary" : "bg-secondary"
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`} />
      </button>
    </div>
  );
}

export function NotificationSettings() {
  const { permission, isSubscribed, loading, subscribe, unsubscribe } = usePushNotifications();
  const [settings, setSettings] = useState<Settings>({
    push_enabled: true, sound_enabled: true, vibration_enabled: true,
    notification_sound: "default", notification_volume: 0.7,
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [customSoundUrl, setCustomSoundUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data } = await supabase
      .from("notification_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (data) {
      const d = data as any;
      setSettings({
        push_enabled: d.push_enabled ?? true,
        sound_enabled: d.sound_enabled ?? true,
        vibration_enabled: d.vibration_enabled ?? true,
        notification_sound: d.notification_sound ?? "default",
        notification_volume: d.notification_volume ?? 0.7,
      });
      if (d.notification_sound && d.notification_sound !== "default") {
        setCustomSoundUrl(d.notification_sound);
      }
    }
  };

  const updateSetting = async (key: keyof Settings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    if (!userId) return;
    await supabase
      .from("notification_settings")
      .upsert({ user_id: userId, [key]: value } as any, { onConflict: "user_id" });
  };

  const handleTogglePush = async () => {
    if (isSubscribed) {
      await unsubscribe();
      await updateSetting("push_enabled", false);
      toast({ title: "Notificações push desativadas" });
    } else {
      const success = await subscribe();
      if (success) {
        await updateSetting("push_enabled", true);
        toast({ title: "Notificações push ativadas!" });
      } else if (permission === "denied") {
        toast({ title: "Permissão negada", description: "Ative nas configurações do navegador.", variant: "destructive" });
      }
    }
  };

  const handleUploadSound = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["mp3", "wav", "ogg", "webm"].includes(ext || "")) {
      toast({ title: "Formato inválido", description: "Use arquivos .mp3, .wav, .ogg ou .webm", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo de 5MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    const filePath = `${userId}/notification.${ext}`;
    const { error } = await supabase.storage
      .from("notification-sounds")
      .upload(filePath, file, { upsert: true });

    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("notification-sounds")
      .getPublicUrl(filePath);

    const soundUrl = urlData.publicUrl;
    setCustomSoundUrl(soundUrl);
    await updateSetting("notification_sound", soundUrl);
    toast({ title: "Som personalizado salvo!" });
    setUploading(false);
  };

  const handleSelectSound = async (type: "default" | "custom") => {
    if (type === "default") {
      await updateSetting("notification_sound", "default");
      setSettings((prev) => ({ ...prev, notification_sound: "default" }));
    } else if (customSoundUrl) {
      await updateSetting("notification_sound", customSoundUrl);
      setSettings((prev) => ({ ...prev, notification_sound: customSoundUrl }));
    }
  };

  const handleTestSound = () => {
    const soundSrc = settings.notification_sound === "default"
      ? "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
      : settings.notification_sound;

    const audio = new Audio(soundSrc);
    audio.volume = settings.notification_volume;
    audio.play().catch(() => {
      toast({ title: "Erro ao reproduzir", description: "Interaja com a página primeiro.", variant: "destructive" });
    });
  };

  const handleTestNotification = async () => {
    if (!userId) return;
    if (Notification.permission === "granted") {
      new Notification("PayHook - Teste", {
        body: "✅ Notificação de teste enviada com sucesso!",
        icon: "/favicon.ico",
      });
    }
    if (isSubscribed) {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ userId, title: "PayHook - Teste Push", body: "✅ Notificação push de teste enviada!", url: "/notifications" }),
      });
    }
    if (settings.sound_enabled) handleTestSound();
    if (settings.vibration_enabled && "vibrate" in navigator) navigator.vibrate([200, 100, 200]);
    toast({ title: "Notificação de teste enviada!" });
  };

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <Bell className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">Configurações de Notificação</h2>
      </div>

      {permission === "unsupported" && (
        <div className="rounded-lg bg-warning/10 border border-warning/30 p-3 mb-4">
          <p className="text-xs text-warning">Seu navegador não suporta notificações push.</p>
        </div>
      )}
      {permission === "denied" && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 mb-4">
          <p className="text-xs text-destructive">Notificações foram bloqueadas. Ative nas configurações do navegador.</p>
        </div>
      )}

      <div className="divide-y divide-border">
        <SettingRow
          icon={isSubscribed ? Bell : BellOff}
          label="Notificações Push"
          description={isSubscribed ? "Ativadas - você receberá alertas mesmo com a aba fechada" : "Desativadas - clique para ativar"}
          enabled={isSubscribed}
          onToggle={handleTogglePush}
          disabled={loading || permission === "unsupported"}
        />
        <SettingRow
          icon={settings.sound_enabled ? Volume2 : VolumeX}
          label="Alerta Sonoro"
          description="Tocar som ao receber notificações"
          enabled={settings.sound_enabled}
          onToggle={() => updateSetting("sound_enabled", !settings.sound_enabled)}
        />
        <SettingRow
          icon={Vibrate}
          label="Vibração (Mobile)"
          description="Vibrar ao receber notificações em dispositivos móveis"
          enabled={settings.vibration_enabled}
          onToggle={() => updateSetting("vibration_enabled", !settings.vibration_enabled)}
        />
      </div>

      {/* Sound Customization */}
      <div className="mt-4 pt-4 border-t border-border space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Music className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Som da Notificação</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleSelectSound("default")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              settings.notification_sound === "default"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            Som Padrão
          </button>
          <button
            onClick={() => handleSelectSound("custom")}
            disabled={!customSoundUrl}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
              settings.notification_sound !== "default"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            Som Personalizado
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.ogg,.webm"
            onChange={handleUploadSound}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Enviando..." : "Enviar Áudio"}
          </button>
          <button
            onClick={handleTestSound}
            className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            <Play className="h-3.5 w-3.5" />
            Testar Som
          </button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-3">
          <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.notification_volume}
            onChange={(e) => updateSetting("notification_volume", Number(e.target.value))}
            className="flex-1 h-1.5 accent-primary"
          />
          <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground w-8 text-right">{Math.round(settings.notification_volume * 100)}%</span>
        </div>
      </div>

      {/* Test Notification */}
      <div className="mt-4 pt-4 border-t border-border">
        <button
          onClick={handleTestNotification}
          className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
        >
          <Send className="h-4 w-4" />
          Testar Notificação
        </button>
      </div>
    </div>
  );
}
