import { useEffect, useState } from "react";
import { fetchPaymentStatsByGateway } from "@/lib/supabase-helpers";
import { useGateway } from "@/contexts/GatewayContext";
import { DollarSign, TrendingUp, ArrowRight, Layers } from "lucide-react";
import { getGatewayIcon } from "@/components/GatewayIconPicker";

export function GatewayOverview() {
  const { gateways, setSelectedGateway } = useGateway();
  const [statsByGateway, setStatsByGateway] = useState<Record<string, { paid: number; pending: number; failed: number; total: number; count: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPaymentStatsByGateway().then((stats) => {
      setStatsByGateway(stats);
      setLoading(false);
    });
  }, []);

  // Merge gateway configs with stats (some gateways may have no payments yet)
  const allGateways = new Set([
    ...gateways.map((g) => g.name),
    ...Object.keys(statsByGateway),
  ]);

  const gatewayList = Array.from(allGateways).map((name) => {
    const config = gateways.find((g) => g.name === name);
    return {
      name,
      displayName: config?.display_name || name,
      icon: config?.icon || "credit-card",
      stats: statsByGateway[name] || { paid: 0, pending: 0, failed: 0, total: 0, count: 0 },
      configured: !!config,
    };
  });

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card rounded-xl p-5 animate-pulse h-40" />
        ))}
      </div>
    );
  }

  if (gatewayList.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <Layers className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">
          Nenhum gateway configurado. Vá em Configurações para adicionar um gateway.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {gatewayList.map((gw) => (
        <button
          key={gw.name}
          onClick={() => setSelectedGateway(gw.name)}
          className="glass-card rounded-xl p-5 text-left transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {(() => {
                const Icon = getGatewayIcon(gw.icon);
                return (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                );
              })()}
              <h3 className="font-semibold text-sm">{gw.displayName}</h3>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          <p className="text-2xl font-bold font-mono mb-3">
            R$ {gw.stats.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground">Pagos</p>
              <p className="font-mono font-medium text-success">
                R$ {gw.stats.paid.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Pendentes</p>
              <p className="font-mono font-medium text-warning">
                R$ {gw.stats.pending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Transações</p>
              <p className="font-mono font-medium">{gw.stats.count}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
