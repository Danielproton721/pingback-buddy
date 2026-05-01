import { Badge } from "@/components/ui/badge";
import type { PaymentStatus } from "@/lib/supabase-helpers";

const statusConfig: Record<PaymentStatus, { label: string; class: string }> = {
  paid: { label: "Pago", class: "status-paid" },
  pending: { label: "Pendente", class: "status-pending" },
  failed: { label: "Recusado", class: "status-failed" },
  refunded: { label: "Estornado", class: "status-refunded" },
  chargeback: { label: "Chargeback", class: "status-chargeback" },
  cancelled: { label: "Cancelado", class: "status-cancelled" },
};

export function StatusBadge({ status }: { status: PaymentStatus }) {
  const config = statusConfig[status] || { label: status, class: "" };
  return (
    <Badge variant="outline" className={`${config.class} border font-mono text-xs`}>
      {config.label}
    </Badge>
  );
}
