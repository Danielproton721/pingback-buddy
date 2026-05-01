import { useState, useEffect } from "react";
import { fetchWebhookLogs, deleteAllWebhookLogs } from "@/lib/supabase-helpers";
import type { WebhookLog } from "@/lib/supabase-helpers";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export default function WebhookLogs() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchWebhookLogs().then(({ data }) => {
      if (data) setLogs(data as unknown as WebhookLog[]);
      setLoading(false);
    });
  }, []);

  const handleDeleteAll = async () => {
    await deleteAllWebhookLogs();
    setLogs([]);
    toast({ title: "Histórico limpo", description: "Todos os webhook logs foram removidos." });
  };

  const statusColor = (s: string) =>
    s === "processed" ? "text-success" : s === "error" ? "text-destructive" : "text-warning";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Webhook Logs</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Todos os webhooks recebidos e seus payloads</p>
        </div>
        {logs.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="inline-flex items-center gap-2 rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 self-start sm:self-auto">
                <Trash2 className="h-4 w-4" />
                Limpar tudo
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar histórico</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja apagar todos os {logs.length} webhook logs? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Apagar tudo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="glass-card rounded-xl divide-y divide-border">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhum log encontrado</div>
        ) : (
          logs.map((log) => (
            <div key={log.id}>
              <button
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                className="flex w-full items-center gap-4 px-4 py-3 text-left text-sm transition-colors hover:bg-secondary/30"
              >
                {expandedId === log.id ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className={`font-mono text-xs font-medium ${statusColor(log.status)}`}>
                  {log.status.toUpperCase()}
                </span>
                <span className="text-xs text-muted-foreground">{log.gateway || "unknown"}</span>
                <span className="text-xs text-muted-foreground">{log.ip_address || "—"}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {format(new Date(log.received_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                </span>
              </button>
              {expandedId === log.id && (
                <div className="border-t border-border bg-secondary/20 px-4 py-4">
                  {log.error_message && (
                    <div className="mb-3 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                      <strong>Erro:</strong> {log.error_message}
                    </div>
                  )}
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Payload bruto:</p>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-background p-3 font-mono text-xs">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
