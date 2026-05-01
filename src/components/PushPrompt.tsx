import { Bell, BellOff, X } from "lucide-react";
import { useState } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function PushPrompt() {
  const { permission, isSubscribed, loading, subscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if already subscribed, dismissed, denied, or unsupported
  if (isSubscribed || dismissed || permission === "denied" || permission === "unsupported") {
    return null;
  }

  const handleActivate = async () => {
    await subscribe();
  };

  return (
    <div className="glass-card rounded-xl p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 glow-primary">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
          <Bell className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">Ativar Notificações</p>
          <p className="text-xs text-muted-foreground">
            Receba alertas em tempo real, mesmo com a aba fechada.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <button
          onClick={handleActivate}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          Ativar
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
