import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchGatewayConfigs, createGatewayConfig, deleteGatewayConfig, updateGatewayDisplayName, updateGatewayIcon } from "@/lib/supabase-helpers";
import type { GatewayConfig } from "@/lib/supabase-helpers";
import { Plus, Trash2, Copy, Eye, EyeOff, Webhook, Pencil, Check, X, AlertTriangle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { GatewayIconPicker, getGatewayIcon } from "@/components/GatewayIconPicker";
import { useToast } from "@/hooks/use-toast";
import { NotificationSettings } from "@/components/NotificationSettings";
import { NotificationTemplates } from "@/components/NotificationTemplates";
import { useGateway } from "@/contexts/GatewayContext";

export default function Settings() {
  const [configs, setConfigs] = useState<GatewayConfig[]>([]);
  const [name, setName] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const { refreshGateways } = useGateway();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    const { data } = await fetchGatewayConfigs();
    if (data) setConfigs(data as unknown as GatewayConfig[]);
  };

  const handleAdd = async () => {
    if (!name.trim() || !secretKey.trim() || !userId) return;
    await createGatewayConfig({ name: name.trim(), secret_key: secretKey.trim(), user_id: userId });
    setName("");
    setSecretKey("");
    loadConfigs();
    refreshGateways();
    toast({ title: "Gateway adicionado", description: `${name} foi configurado com sucesso.` });
  };

  const handleDelete = async (id: string) => {
    await deleteGatewayConfig(id);
    loadConfigs();
    refreshGateways();
    toast({ title: "Gateway removido" });
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    await updateGatewayDisplayName(id, editName.trim());
    setEditingId(null);
    loadConfigs();
    refreshGateways();
    toast({ title: "Gateway renomeado" });
  };

  const handleIconChange = async (id: string, icon: string) => {
    await updateGatewayIcon(id, icon);
    loadConfigs();
    refreshGateways();
    toast({ title: "Ícone atualizado" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-xs md:text-sm text-muted-foreground">Gerencie seus gateways, webhook e notificações</p>
      </div>

      {/* Notification Settings */}
      <NotificationSettings />

      {/* Notification Templates */}
      <NotificationTemplates />

      {/* Webhook URLs */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <Webhook className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Endpoints do Webhook</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Configure a URL correspondente no seu gateway de pagamento. Cada gateway tem uma URL única.
        </p>
        {configs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Adicione um gateway abaixo para ver a URL do webhook.</p>
        ) : (
          <div className="space-y-2">
            {configs.map((c) => {
              const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/webhook-payment?gateway=${encodeURIComponent(c.name)}`;
              return (
                <div key={c.id} className="flex items-center gap-2">
                  <span className="text-xs font-medium min-w-[80px] truncate">{c.display_name || c.name}:</span>
                  <code className="flex-1 rounded-lg bg-secondary px-3 py-2 font-mono text-[10px] break-all">
                    {webhookUrl}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl);
                      toast({ title: "URL copiada!" });
                    }}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Gateway */}
      <div className="glass-card rounded-xl p-5">
        <h2 className="text-base font-semibold mb-4">Adicionar Gateway</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            placeholder="Nome do gateway (ex: Stripe)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            type="password"
            placeholder="Secret key"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={handleAdd}
            disabled={!name.trim() || !secretKey.trim()}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
        </div>
      </div>

      {/* Gateway List */}
      <div className="glass-card rounded-xl">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold">Gateways Configurados</h2>
        </div>
        {configs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum gateway configurado</div>
        ) : (
          <div className="divide-y divide-border">
            {configs.map((c) => (
              <div key={c.id} className="flex items-start gap-3 px-4 py-3">
                <GatewayIconPicker
                  value={c.icon || "credit-card"}
                  onChange={(icon) => handleIconChange(c.id, icon)}
                />
                <div className="flex-1 min-w-0">
                  {editingId === c.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleRename(c.id);
                          } else if (e.key === "Escape") {
                            setEditingId(null);
                          }
                        }}
                      />
                      <button
                        onClick={() => handleRename(c.id)}
                        className="rounded p-1 text-success hover:bg-success/10"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded p-1 text-muted-foreground hover:bg-secondary"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{c.display_name || c.name}</p>
                      {c.display_name && c.display_name !== c.name && (
                        <span className="text-[10px] text-muted-foreground font-mono">({c.name})</span>
                      )}
                      <button
                        onClick={() => {
                          setEditingId(c.id);
                          setEditName(c.display_name || c.name);
                        }}
                        className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-secondary"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <code className="font-mono text-xs text-muted-foreground">
                      {showSecrets[c.id] ? c.secret_key : "••••••••••••••••"}
                    </code>
                    <button
                      onClick={() => setShowSecrets((p) => ({ ...p, [c.id]: !p[c.id] }))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {showSecrets[c.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                  </div>
                  {/* Webhook URL inline */}
                  <div className="flex items-center gap-2 mt-2 rounded-lg bg-muted/50 px-3 py-2">
                    <Webhook className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <code className="flex-1 font-mono text-[10px] text-muted-foreground break-all select-all">
                      {`${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/webhook-payment?gateway=${encodeURIComponent(c.name)}`}
                    </code>
                    <button
                      onClick={() => {
                        const url = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/webhook-payment?gateway=${encodeURIComponent(c.name)}`;
                        navigator.clipboard.writeText(url);
                        toast({ title: "URL do webhook copiada!" });
                      }}
                      className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-secondary shrink-0"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      aria-label="Excluir gateway"
                      className="tap mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir gateway</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir <strong>{c.display_name || c.name}</strong>? Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
