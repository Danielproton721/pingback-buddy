import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPaymentStatsByGateway } from "@/lib/supabase-helpers";
import { useGateway } from "@/contexts/GatewayContext";
import { ArrowRight, Plus, Wallet } from "lucide-react";
import { getGatewayIcon } from "@/components/GatewayIconPicker";

// Gradientes dos cartões (estáveis por nome do gateway)
const CARD_GRADIENTS = [
  "from-violet-600 via-violet-700 to-indigo-800",
  "from-cyan-500 via-sky-600 to-blue-700",
  "from-emerald-500 via-teal-600 to-teal-800",
  "from-rose-500 via-pink-600 to-fuchsia-700",
  "from-amber-500 via-orange-600 to-red-600",
  "from-slate-600 via-slate-700 to-slate-900",
];

const gradientFor = (name: string) => {
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return CARD_GRADIENTS[hash % CARD_GRADIENTS.length];
};

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export function GatewayOverview() {
  const { gateways, setSelectedGateway } = useGateway();
  const [statsByGateway, setStatsByGateway] = useState<
    Record<string, { paid: number; pending: number; failed: number; total: number; count: number }>
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPaymentStatsByGateway().then((stats) => {
      setStatsByGateway(stats);
      setLoading(false);
    });
  }, []);

  const allGateways = new Set([...gateways.map((g) => g.name), ...Object.keys(statsByGateway)]);

  const gatewayList = Array.from(allGateways).map((name) => {
    const config = gateways.find((g) => g.name === name);
    return {
      name,
      displayName: config?.display_name || name,
      icon: config?.icon || "credit-card",
      stats: statsByGateway[name] || { paid: 0, pending: 0, failed: 0, total: 0, count: 0 },
    };
  });

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[184px] animate-pulse rounded-2xl bg-secondary/40"
            style={{ marginTop: i === 0 ? 0 : -120 }}
          />
        ))}
      </div>
    );
  }

  if (gatewayList.length === 0) {
    return (
      <Link
        to="/settings"
        className="tap flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border p-10 text-center"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Wallet className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">Sua carteira está vazia</p>
          <p className="mt-1 text-xs text-muted-foreground">Toque para adicionar seu primeiro gateway</p>
        </div>
      </Link>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="pb-1">
        {gatewayList.map((gw, i) => {
          const Icon = getGatewayIcon(gw.icon);
          return (
            <button
              key={gw.name}
              onClick={() => setSelectedGateway(gw.name)}
              className={`tap group relative block w-full overflow-hidden rounded-2xl bg-gradient-to-br text-left text-white shadow-[0_10px_28px_hsl(225_50%_2%/0.5)] ring-1 ring-white/15 ${gradientFor(
                gw.name
              )}`}
              style={{ height: 184, marginTop: i === 0 ? 0 : -120, zIndex: i + 1 }}
            >
              {/* círculos decorativos (estilo cartão) */}
              <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
              <div className="pointer-events-none absolute right-12 top-20 h-24 w-24 rounded-full bg-white/5" />

              <div className="relative flex h-full flex-col justify-between p-5">
                {/* faixa visível na pilha: ícone + nome + total */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold leading-tight">{gw.displayName}</p>
                      <p className="text-[11px] text-white/70">{gw.stats.count} transações</p>
                    </div>
                  </div>
                  <p className="shrink-0 text-right font-mono text-lg font-bold">{brl(gw.stats.total)}</p>
                </div>

                {/* base (aparece no cartão de cima / ao tocar): resumo */}
                <div className="flex items-end justify-between">
                  <div className="flex gap-5 text-[11px]">
                    <div>
                      <p className="text-white/60">Pagos</p>
                      <p className="font-mono font-medium">{brl(gw.stats.paid)}</p>
                    </div>
                    <div>
                      <p className="text-white/60">Pendentes</p>
                      <p className="font-mono font-medium">{brl(gw.stats.pending)}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-white/70 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* adicionar novo cartão */}
      <Link
        to="/settings"
        className="tap mt-4 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground"
      >
        <Plus className="h-4 w-4" />
        Adicionar gateway
      </Link>
    </div>
  );
}
