import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deleteAllWebhookLogs } from "@/lib/supabase-helpers";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bug, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, Clock, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface WebhookLogWithMeta {
  id: string;
  payload: any;
  status: string;
  ip_address: string | null;
  error_message: string | null;
  gateway: string | null;
  received_at: string;
}

export default function Debug() {
  const [logs, setLogs] = useState<WebhookLogWithMeta[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("webhook_logs")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(50);
      if (data) setLogs(data as unknown as WebhookLogWithMeta[]);
      setLoading(false);
    };
    load();
  }, []);

  const handleDeleteAll = async () => {
    await deleteAllWebhookLogs();
    setLogs([]);
    toast({ title: "Histórico limpo", description: "Todos os logs de debug foram removidos." });
  };

  const getMeta = (log: WebhookLogWithMeta) => log.payload?._meta || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bug className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            Debug
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">Análise técnica dos webhooks recebidos</p>
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
                  Tem certeza que deseja apagar todos os {logs.length} logs? Esta ação não pode ser desfeita.
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
          <div className="p-8 text-center text-muted-foreground">Nenhum webhook recebido ainda</div>
        ) : (
          logs.map((log) => {
            const meta = getMeta(log);
            const isExpanded = expandedId === log.id;
            return (
              <div key={log.id}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-secondary/30"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={`font-mono text-xs font-medium ${log.status === "processed" ? "text-success" : "text-destructive"}`}>
                    {log.status.toUpperCase()}
                  </span>
                  <span className="text-xs text-muted-foreground">{log.gateway || "unknown"}</span>
                  {meta?.processing_time_ms != null && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {meta.processing_time_ms}ms
                    </span>
                  )}
                  {meta?.missing_fields?.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">
                      <AlertTriangle className="h-3 w-3" />
                      {meta.missing_fields.length} campo(s) ausente(s)
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {format(new Date(log.received_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-border bg-secondary/20 px-4 py-4 space-y-4">
                    {log.error_message && (
                      <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                        <strong>Erro:</strong> {log.error_message}
                      </div>
                    )}

                    {meta?.mapped_fields && (
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Campos Mapeados:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {Object.entries(meta.mapped_fields).map(([key, value]) => (
                            <div key={key} className="flex items-start gap-2 rounded-lg bg-background p-2">
                              <CheckCircle2 className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${value != null ? "text-success" : "text-muted-foreground"}`} />
                              <div className="min-w-0">
                                <p className="text-[10px] font-medium text-muted-foreground uppercase">{key}</p>
                                <p className="text-xs font-mono truncate">{value != null ? String(value) : "—"}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {meta?.missing_fields?.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-medium text-warning">Campos Ausentes:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {meta.missing_fields.map((f: string) => (
                            <span key={f} className="rounded-full bg-warning/15 px-2.5 py-0.5 text-[10px] font-medium text-warning">
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {meta?.processing_time_ms != null && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        Tempo de processamento: <strong>{meta.processing_time_ms}ms</strong>
                      </div>
                    )}

                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Payload Bruto (sem _meta):</p>
                      <pre className="max-h-64 overflow-auto rounded-lg bg-background p-3 font-mono text-xs">
                        {JSON.stringify(
                          Object.fromEntries(Object.entries(log.payload || {}).filter(([k]) => k !== "_meta")),
                          null, 2
                        )}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
