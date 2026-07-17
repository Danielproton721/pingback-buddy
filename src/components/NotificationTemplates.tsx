import { useState, useEffect } from "react";
import { MessageSquare, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ValuePos = "start" | "end";

const buildMessage = (pos: ValuePos) =>
  pos === "start"
    ? "R$ {amount} — {customer} • {product}"
    : "{customer} • {product} — R$ {amount}";

const detectPos = (msg?: string | null): ValuePos =>
  msg && msg.trim().startsWith("R$ {amount}") ? "start" : "end";

const previewText = (pos: ValuePos) =>
  pos === "start"
    ? "R$ 49,90 — João Silva • Curso de Marketing • PIX • Pagou.Ai"
    : "João Silva • Curso de Marketing • PIX • Pagou.Ai — R$ 49,90";

const DEFAULT_PAID_TITLE = "Pagamento confirmado";
const DEFAULT_PENDING_TITLE = "Novo pagamento";

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        enabled ? "bg-primary" : "bg-secondary"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function NotificationTemplates() {
  const [paidTitle, setPaidTitle] = useState(DEFAULT_PAID_TITLE);
  const [pendingTitle, setPendingTitle] = useState(DEFAULT_PENDING_TITLE);
  const [paidEnabled, setPaidEnabled] = useState(true);
  const [pendingEnabled, setPendingEnabled] = useState(true);
  const [valuePos, setValuePos] = useState<ValuePos>("end");
  const [userId, setUserId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data } = await supabase
      .from("notification_settings")
      .select("paid_title, paid_message, pending_title, pending_message, paid_enabled, pending_enabled")
      .eq("user_id", user.id)
      .single();

    if (data) {
      const d = data as any;
      setPaidTitle(d.paid_title ?? DEFAULT_PAID_TITLE);
      setPendingTitle(d.pending_title ?? DEFAULT_PENDING_TITLE);
      setPaidEnabled(d.paid_enabled ?? true);
      setPendingEnabled(d.pending_enabled ?? true);
      setValuePos(detectPos(d.paid_message));
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    const message = buildMessage(valuePos);
    await supabase.from("notification_settings").upsert(
      {
        user_id: userId,
        paid_title: paidTitle,
        pending_title: pendingTitle,
        paid_message: message,
        pending_message: message,
        paid_enabled: paidEnabled,
        pending_enabled: pendingEnabled,
      } as any,
      { onConflict: "user_id" }
    );
    setDirty(false);
    setSaving(false);
    toast({ title: "Notificações salvas!" });
  };

  const mark = () => setDirty(true);

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="mb-4 flex items-center gap-3">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">Texto das Notificações</h2>
      </div>

      {/* Posição do valor */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Onde mostrar o valor</p>
        <div className="grid grid-cols-2 gap-2">
          {(["start", "end"] as const).map((p) => (
            <button
              key={p}
              onClick={() => {
                setValuePos(p);
                mark();
              }}
              className={`tap rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                valuePos === p ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground"
              }`}
            >
              {p === "start" ? "No início" : "No final"}
            </button>
          ))}
        </div>
        <div className="rounded-lg bg-secondary/50 p-3">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Prévia</p>
          <p className="text-sm">{previewText(valuePos)}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Cliente, produto e método aparecem quando o gateway os envia — alguns
          gateways mandam menos dados que outros.
        </p>
      </div>

      {/* Pago */}
      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            <p className="text-sm font-medium">Pagamento confirmado</p>
          </div>
          <Toggle
            enabled={paidEnabled}
            onToggle={() => {
              setPaidEnabled((v) => !v);
              mark();
            }}
          />
        </div>
        <input
          value={paidTitle}
          disabled={!paidEnabled}
          onChange={(e) => {
            setPaidTitle(e.target.value);
            mark();
          }}
          placeholder="Título da notificação"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
        />
      </div>

      {/* Pendente */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            <p className="text-sm font-medium">Pagamento pendente</p>
          </div>
          <Toggle
            enabled={pendingEnabled}
            onToggle={() => {
              setPendingEnabled((v) => !v);
              mark();
            }}
          />
        </div>
        <input
          value={pendingTitle}
          disabled={!pendingEnabled}
          onChange={(e) => {
            setPendingTitle(e.target.value);
            mark();
          }}
          placeholder="Título da notificação"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={!dirty || saving}
        className="tap mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}
