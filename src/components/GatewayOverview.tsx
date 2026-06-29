import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPaymentStatsByGateway, deleteGatewayConfig } from "@/lib/supabase-helpers";
import { useGateway } from "@/contexts/GatewayContext";
import { ArrowRight, Plus, Wallet, Trash2 } from "lucide-react";
import { getGatewayIcon } from "@/components/GatewayIconPicker";
import { useToast } from "@/hooks/use-toast";

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

const CARD_H = 184;
const OVERLAP = 120;
const SWIPE_THRESHOLD = 90;

type Stats = { paid: number; pending: number; failed: number; total: number; count: number };
const EMPTY_STATS: Stats = { paid: 0, pending: 0, failed: 0, total: 0, count: 0 };

export function GatewayOverview() {
  const { gateways, setSelectedGateway, refreshGateways } = useGateway();
  const [statsByGateway, setStatsByGateway] = useState<Record<string, Stats>>({});
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null); // long-press menu
  const [dragName, setDragName] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const { toast } = useToast();

  const gest = useRef({ startX: 0, startY: 0, moved: false, longFired: false, timer: 0 });

  useEffect(() => {
    fetchPaymentStatsByGateway().then((s) => {
      setStatsByGateway(s);
      setLoading(false);
    });
  }, []);

  const names = Array.from(new Set([...gateways.map((x) => x.name), ...Object.keys(statsByGateway)]));
  const namesKey = names.join("|");

  // Mantém a ordem sincronizada com os gateways disponíveis (novos vão pro fim)
  useEffect(() => {
    setOrder((prev) => {
      const kept = prev.filter((n) => names.includes(n));
      const added = names.filter((n) => !kept.includes(n));
      return [...kept, ...added];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namesKey]);

  const getGw = (name: string) => {
    const config = gateways.find((x) => x.name === name);
    return {
      name,
      displayName: config?.display_name || name,
      icon: config?.icon || "credit-card",
      configId: config?.id as string | undefined,
      stats: statsByGateway[name] || EMPTY_STATS,
    };
  };

  const handleDelete = async (name: string) => {
    const gw = getGw(name);
    setActive(null);
    setOrder((prev) => prev.filter((n) => n !== name));
    if (gw.configId) {
      await deleteGatewayConfig(gw.configId);
      await refreshGateways();
    }
    toast({ title: "Gateway deletado" });
  };

  // ---------- gestos: tap / swipe / long-press ----------
  const onDown = (e: React.PointerEvent, name: string) => {
    gest.current.startX = e.clientX;
    gest.current.startY = e.clientY;
    gest.current.moved = false;
    gest.current.longFired = false;
    clearTimeout(gest.current.timer);
    gest.current.timer = window.setTimeout(() => {
      gest.current.longFired = true;
      setDragName(null);
      setDragX(0);
      setActive(name);
    }, 450);
    setDragName(name);
  };

  const onMove = (e: React.PointerEvent, isFront: boolean) => {
    if (dragName === null) return;
    const dx = e.clientX - gest.current.startX;
    const dy = e.clientY - gest.current.startY;
    if (!gest.current.moved && Math.hypot(dx, dy) > 8) {
      gest.current.moved = true;
      clearTimeout(gest.current.timer);
    }
    if (gest.current.moved && isFront && Math.abs(dx) > Math.abs(dy)) {
      setDragX(dx);
    }
  };

  const onUp = (name: string, isFront: boolean) => {
    clearTimeout(gest.current.timer);
    setDragName(null);
    if (gest.current.longFired) {
      setDragX(0);
      return;
    }
    if (gest.current.moved && isFront && Math.abs(dragX) > SWIPE_THRESHOLD) {
      // arrastou o da frente: manda pro fundo da pilha
      setLeaving(true);
      setDragX(dragX > 0 ? 700 : -700);
      window.setTimeout(() => {
        setOrder((prev) => [name, ...prev.filter((n) => n !== name)]);
        setDragX(0);
        setLeaving(false);
      }, 220);
    } else if (!gest.current.moved) {
      // toque simples: abre o gateway
      setSelectedGateway(name);
    } else {
      setDragX(0); // não passou do limite: volta
    }
  };

  const cardInner = (gw: ReturnType<typeof getGw>) => {
    const Icon = getGatewayIcon(gw.icon);
    return (
      <>
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute right-12 top-20 h-24 w-24 rounded-full bg-white/5" />
        <div className="relative flex h-full flex-col justify-between p-5">
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
            <ArrowRight className="h-4 w-4 text-white/70" />
          </div>
        </div>
      </>
    );
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[184px] animate-pulse rounded-2xl bg-secondary/40" style={{ marginTop: i === 0 ? 0 : -120 }} />
        ))}
      </div>
    );
  }

  if (order.length === 0) {
    return (
      <Link
        to="/settings"
        className="tap mx-auto flex w-full max-w-lg flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border p-10 text-center"
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
      <div className="select-none pb-1">
        {order.map((name, i) => {
          const gw = getGw(name);
          const isFront = i === order.length - 1;
          const isDrag = dragName === name && isFront;
          const hidden = active === name;
          return (
            <button
              key={name}
              onPointerDown={(e) => onDown(e, name)}
              onPointerMove={(e) => onMove(e, isFront)}
              onPointerUp={() => onUp(name, isFront)}
              onPointerCancel={() => {
                clearTimeout(gest.current.timer);
                setDragName(null);
                setDragX(0);
              }}
              className={`relative block w-full overflow-hidden rounded-2xl bg-gradient-to-br text-left text-white shadow-[0_10px_28px_hsl(225_50%_2%/0.5)] ring-1 ring-white/15 ${gradientFor(name)}`}
              style={{
                height: CARD_H,
                marginTop: i === 0 ? 0 : -OVERLAP,
                zIndex: i + 1,
                transform: isFront && dragX ? `translateX(${dragX}px) rotate(${dragX * 0.02}deg)` : undefined,
                transition: isDrag && !leaving ? "none" : "transform 0.25s ease, opacity 0.2s ease",
                opacity: hidden ? 0 : isFront && leaving ? 0 : 1,
                touchAction: "pan-y",
              }}
            >
              {cardInner(gw)}
            </button>
          );
        })}
      </div>

      {order.length > 1 && (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Arraste para o lado para trocar • Segure para opções
        </p>
      )}

      <Link
        to="/settings"
        className="tap mt-3 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground"
      >
        <Plus className="h-4 w-4" />
        Adicionar gateway
      </Link>

      {/* Segurar: fundo desfocado + cartão em destaque + Deletar */}
      {active && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-black/50 p-6 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setActive(null)}
        >
          <div
            className={`relative w-full max-w-sm overflow-hidden rounded-2xl bg-gradient-to-br text-white shadow-2xl ring-1 ring-white/20 animate-in zoom-in-95 duration-200 ${gradientFor(active)}`}
            style={{ height: CARD_H }}
            onClick={(e) => e.stopPropagation()}
          >
            {cardInner(getGw(active))}
          </div>
          <button
            onClick={() => handleDelete(active)}
            className="tap flex items-center gap-2 rounded-xl bg-destructive px-7 py-3 text-sm font-semibold text-destructive-foreground shadow-lg animate-in zoom-in-95 duration-200"
          >
            <Trash2 className="h-4 w-4" />
            Deletar
          </button>
        </div>
      )}
    </div>
  );
}
