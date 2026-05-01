import { useState, useEffect } from "react";
import { MessageSquare, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Templates {
  paid_title: string;
  paid_message: string;
  pending_title: string;
  pending_message: string;
}

const DEFAULTS: Templates = {
  paid_title: "Pagamento confirmado",
  paid_message: "{customer} - R$ {amount} - {product} via {method}",
  pending_title: "Novo pagamento",
  pending_message: "{customer} - R$ {amount} - {product} via {method}",
};

const VARIABLES = [
  { tag: "{customer}", desc: "Nome do cliente" },
  { tag: "{amount}", desc: "Valor (R$)" },
  { tag: "{product}", desc: "Nome do produto" },
  { tag: "{method}", desc: "Método de pagamento" },
];

export function NotificationTemplates() {
  const [templates, setTemplates] = useState<Templates>(DEFAULTS);
  const [userId, setUserId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data } = await supabase
      .from("notification_settings")
      .select("paid_title, paid_message, pending_title, pending_message")
      .eq("user_id", user.id)
      .single();

    if (data) {
      const d = data as any;
      setTemplates({
        paid_title: d.paid_title ?? DEFAULTS.paid_title,
        paid_message: d.paid_message ?? DEFAULTS.paid_message,
        pending_title: d.pending_title ?? DEFAULTS.pending_title,
        pending_message: d.pending_message ?? DEFAULTS.pending_message,
      });
    }
  };

  const handleChange = (key: keyof Templates, value: string) => {
    setTemplates((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    await supabase
      .from("notification_settings")
      .upsert({
        user_id: userId,
        paid_title: templates.paid_title,
        paid_message: templates.paid_message,
        pending_title: templates.pending_title,
        pending_message: templates.pending_message,
      } as any, { onConflict: "user_id" });
    setDirty(false);
    setSaving(false);
    toast({ title: "Templates salvos!" });
  };

  const handleReset = () => {
    setTemplates(DEFAULTS);
    setDirty(true);
  };

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">Templates de Notificação</h2>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Personalize o texto das notificações para cada status de pagamento. Use as variáveis abaixo:
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {VARIABLES.map((v) => (
          <span
            key={v.tag}
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs font-mono"
            title={v.desc}
          >
            {v.tag}
            <span className="text-muted-foreground font-sans">– {v.desc}</span>
          </span>
        ))}
      </div>

      <div className="space-y-5">
        {/* Paid template */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            <p className="text-sm font-medium">Pagamento Confirmado (Pago)</p>
          </div>
          <input
            value={templates.paid_title}
            onChange={(e) => handleChange("paid_title", e.target.value)}
            placeholder="Título da notificação"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            value={templates.paid_message}
            onChange={(e) => handleChange("paid_message", e.target.value)}
            placeholder="Mensagem da notificação"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Pending template */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500 dark:bg-amber-400" />
            <p className="text-sm font-medium">Pagamento Pendente</p>
          </div>
          <input
            value={templates.pending_title}
            onChange={(e) => handleChange("pending_title", e.target.value)}
            placeholder="Título da notificação"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            value={templates.pending_message}
            onChange={(e) => handleChange("pending_message", e.target.value)}
            placeholder="Mensagem da notificação"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar Templates"}
        </button>
        <button
          onClick={handleReset}
          className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
        >
          Restaurar Padrão
        </button>
      </div>
    </div>
  );
}
