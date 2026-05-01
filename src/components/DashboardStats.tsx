import { useEffect, useState } from "react";
import { fetchPaymentStats } from "@/lib/supabase-helpers";
import { DollarSign, Clock, XCircle, TrendingUp } from "lucide-react";

interface DashboardStatsProps {
  gateway?: string;
}

export function DashboardStats({ gateway }: DashboardStatsProps) {
  const [stats, setStats] = useState({ paid: 0, pending: 0, failed: 0, total: 0 });

  useEffect(() => {
    fetchPaymentStats(gateway).then(setStats);
  }, [gateway]);

  const cards = [
    { label: "Total Faturado", value: stats.total, icon: TrendingUp, color: "text-primary" },
    { label: "Total Pagos", value: stats.paid, icon: DollarSign, color: "text-success" },
    { label: "Total Pendentes", value: stats.pending, icon: Clock, color: "text-warning" },
    { label: "Total Recusados", value: stats.failed, icon: XCircle, color: "text-destructive", isCount: true },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="glass-card rounded-xl p-3 md:p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs md:text-sm text-muted-foreground truncate">{card.label}</p>
            <card.icon className={`h-4 w-4 md:h-5 md:w-5 shrink-0 ${card.color}`} />
          </div>
          <p className="mt-1.5 md:mt-2 text-lg md:text-2xl font-bold font-mono truncate">
            {card.isCount ? card.value : `R$ ${card.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          </p>
        </div>
      ))}
    </div>
  );
}
