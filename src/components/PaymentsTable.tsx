import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchPayments, exportPaymentsCSV } from "@/lib/supabase-helpers";
import type { Payment, PaymentStatus } from "@/lib/supabase-helpers";
import { StatusBadge } from "./StatusBadge";
import { Search, Download, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statuses: (PaymentStatus | "")[] = ["", "paid", "pending", "failed", "refunded", "chargeback", "cancelled"];
const statusLabels: Record<string, string> = {
  "": "Todos", paid: "Pago", pending: "Pendente", failed: "Recusado",
  refunded: "Estornado", chargeback: "Chargeback", cancelled: "Cancelado",
};

function formatLocalDate(dateStr: string | null): string {
  if (!dateStr) return "Não informado";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Não informado";
    return format(d, "dd/MM/yy HH:mm", { locale: ptBR });
  } catch {
    return "Não informado";
  }
}

interface PaymentsTableProps {
  gateway?: string;
}

export function PaymentsTable({ gateway }: PaymentsTableProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "">("");
  const [loading, setLoading] = useState(true);

  const loadPayments = async () => {
    setLoading(true);
    const { data } = await fetchPayments({
      status: statusFilter || undefined,
      search: search || undefined,
      gateway: gateway || undefined,
    });
    if (data) setPayments(data as unknown as Payment[]);
    setLoading(false);
  };

  useEffect(() => { loadPayments(); }, [statusFilter, search, gateway]);

  useEffect(() => {
    const channel = supabase
      .channel("payments-table")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => { loadPayments(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [statusFilter, search, gateway]);

  // Hide gateway column when filtered to a specific gateway
  const showGatewayCol = !gateway;

  return (
    <div className="glass-card rounded-xl">
      <div className="flex flex-col gap-3 border-b border-border p-3 md:p-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base md:text-lg font-semibold">
          Pagamentos {gateway ? `— ${gateway}` : "Recentes"}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] sm:flex-none">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | "")}
              className="h-9 appearance-none rounded-lg border border-input bg-background pl-9 pr-8 text-sm outline-none focus:ring-1 focus:ring-ring"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>{statusLabels[s]}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => exportPaymentsCSV(payments)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
      </div>

      {/* Mobile: card layout */}
      <div className="block md:hidden divide-y divide-border">
        {loading ? (
          <div className="p-6 text-center text-muted-foreground">Carregando...</div>
        ) : payments.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">Nenhum pagamento encontrado</div>
        ) : (
          payments.map((p) => (
            <div key={p.id} className="p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <StatusBadge status={p.status} />
                <span className="font-mono text-sm font-bold">
                  R$ {Number(p.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate max-w-[50%]">{p.customer_name || "Não informado"}</span>
                <span className="text-muted-foreground">{formatLocalDate(p.event_time || p.created_at)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate max-w-[50%]">{p.product_name || "Não informado"}</span>
                <span>{showGatewayCol ? `${p.gateway || ""} · ` : ""}{p.payment_method || ""}</span>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground truncate">{p.transaction_id}</p>
            </div>
          ))
        )}
      </div>

      {/* Desktop: table layout */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-3 font-medium">Transação</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Produto</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Método</th>
              {showGatewayCol && <th className="px-4 py-3 font-medium">Gateway</th>}
              <th className="px-4 py-3 font-medium">Data do Evento</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={showGatewayCol ? 8 : 7} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan={showGatewayCol ? 8 : 7} className="px-4 py-8 text-center text-muted-foreground">Nenhum pagamento encontrado</td></tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                  <td className="px-4 py-3 font-mono text-xs">{p.transaction_id}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 font-mono font-medium">
                    R$ {Number(p.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-xs">{p.product_name || "Não informado"}</td>
                  <td className="px-4 py-3">
                    <div>{p.customer_name || "Não informado"}</div>
                    <div className="text-xs text-muted-foreground">{p.customer_email || ""}</div>
                  </td>
                  <td className="px-4 py-3">{p.payment_method || "Não informado"}</td>
                  {showGatewayCol && <td className="px-4 py-3">{p.gateway || "Não informado"}</td>}
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatLocalDate(p.event_time || p.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
