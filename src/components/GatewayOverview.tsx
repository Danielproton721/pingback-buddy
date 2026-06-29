import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import {
  fetchPaymentStatsByGateway,
  deleteGatewayConfig,
  updateGatewayColor,
  createGatewayConfig,
} from "@/lib/supabase-helpers";
import { supabase } from "@/integrations/supabase/client";
import { useGateway } from "@/contexts/GatewayContext";
import { ArrowRight, Plus, Wallet, Trash2, X } from "lucide-react";
import { getGatewayIcon } from "@/components/GatewayIconPicker";
import { useToast } from "@/hooks/use-toast";

const PALETTE: { key: string; grad: string }[] = [
  { key: "violet", grad: "from-violet-600 via-violet-700 to-indigo-800" },
  { key: "blue", grad: "from-cyan-500 via-sky-600 to-blue-700" },
  { key: "emerald", grad: "from-emerald-500 via-teal-600 to-teal-800" },
  { key: "rose", grad: "from-rose-500 via-pink-600 to-fuchsia-700" },
  { key: "amber", grad: "from-amber-500 via-orange-600 to-red-600" },
  { key: "slate", grad: "from-slate-600 via-slate-700 to-slate-900" },
  { key: "fuchsia", grad: "from-fuchsia-600 via-purple-700 to-violet-900" },
  { key: "lime", grad: "from-lime-500 via-green-600 to-emerald-700" },
  { key: "red", grad: "from-red-500 via-rose-600 to-pink-700" },
  { key: "indigo", grad: "from-indigo-500 via-blue-700 to-cyan-700" },
];

const hashOf = (name: string) => name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
const keyFor = (name: string, color?: string | null) => {
  if (color && PALETTE.some((p) => p.key === color)) return color;
  return PALETTE[hashOf(name) % PALETTE.length].key;
};
const gradOf = (name: string, color?: string | null) =>
  PALETTE.find((p) => p.key === keyFor(name, color))!.grad;

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const CARD_H = 184;
const OVERLAP = 120;
const SWIPE_THRESHOLD = 90;
const SPRING = { type: "spring", duration: 0.45, bounce: 0.2 } as const;

type Stats = { paid: number; pending: number; failed: number; total: number; count: number };
const EMPTY_STATS: Stats = { paid: 0, pending: 0, failed: 0, total: 0, count: 0 };

export function GatewayOverview() {
  const { gateways, setSelectedGateway, refreshGateways } = useGateway();
  const [statsByGateway, setStatsByGateway] = useState<Record<string, Stats>>({});
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [colorOverride, setColorOverride] = useState<Record<string, string>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addSecret, setAddSecret] = useState("");
  const { toast } = useToast();

  const longRef = useRef({ fired: false, timer: 0 });

  useEffect(() => {
    fetchPaymentStatsByGateway().then((s) => {
      setStatsByGateway(s);
      setLoading(false);
    });
  }, []);

  const names = Array.from(new Set([...gateways.map((x) => x.name), ...Object.keys(statsByGateway)]));
  const namesKey = names.join("|");

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
      color: colorOverride[name] ?? ((config?.color as string | null | undefined) || null),
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

  const handleColor = async (name: string, key: string) => {
    setColorOverride((prev) => ({ ...prev, [name]: key }));
    const gw = getGw(name);
    if (gw.configId) {
      await updateGatewayColor(gw.configId, key);
      refreshGateways();
    }
  };

  const handleAdd = async () => {
    const n = addName.trim();
    if (!n || !addSecret.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await createGatewayConfig({ name: n, secret_key: addSecret.trim(), user_id: user.id });
    setAddName("");
    setAddSecret("");
    setShowAdd(false);
    await refreshGateways();
    toast({ title: "Gateway adicionado", description: `${n} foi configurado.` });
  };

  // ---------- gestos ----------
  const startLong = (name: string) => {
    longRef.current.fired = false;
    clearTimeout(longRef.current.timer);
    longRef.current.timer = window.setTimeout(() => {
      longRef.current.fired = true;
      setActive(name);
    }, 450);
  };
  const cancelLong = () => clearTimeout(longRef.current.timer);

  const handleTap = (name: string) => {
    cancelLong();
    if (longRef.current.fired) {
      longRef.current.fired = false;
      return;
    }
    setSelectedGateway(name);
  };

  const handleDragEnd = (name: string, info: PanInfo) => {
    cancelLong();
    if (longRef.current.fired) return;
    if (Math.abs(info.offset.x) > SWIPE_THRESHOLD) {
      setOrder((prev) => [name, ...prev.filter((n) => n !== name)]);
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

  const activeGw = active ? getGw(active) : null;

  return (
    <div className="mx-auto w-full max-w-lg">
      {order.length === 0 ? (
        <button
          onClick={() => setShowAdd(true)}
          className="tap flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border p-10 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Sua carteira está vazia</p>
            <p className="mt-1 text-xs text-muted-foreground">Toque para adicionar seu primeiro gateway</p>
          </div>
        </button>
      ) : (
        <>
          <div className="select-none pb-1">
            {order.map((name, i) => {
              const gw = getGw(name);
              const isFront = i === order.length - 1;
              return (
                <motion.button
                  key={name}
                  layout
                  transition={SPRING}
                  drag={isFront ? "x" : false}
                  dragSnapToOrigin
                  dragElastic={0.5}
                  onPointerDown={() => startLong(name)}
                  onDragStart={cancelLong}
                  onDragEnd={(_e, info) => handleDragEnd(name, info)}
                  onTap={() => handleTap(name)}
                  className={`relative block w-full overflow-hidden rounded-2xl bg-gradient-to-br text-left text-white shadow-[0_10px_28px_hsl(225_50%_2%/0.5)] ring-1 ring-white/15 ${gradOf(name, gw.color)}`}
                  style={{
                    height: CARD_H,
                    marginTop: i === 0 ? 0 : -OVERLAP,
                    zIndex: i + 1,
                    opacity: active === name ? 0 : 1,
                    touchAction: "pan-y",
                  }}
                >
                  {cardInner(gw)}
                </motion.button>
              );
            })}
          </div>

          {order.length > 1 && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Arraste para o lado para trocar • Segure para opções
            </p>
          )}

          <button
            onClick={() => setShowAdd(true)}
            className="tap mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground"
          >
            <Plus className="h-4 w-4" />
            Adicionar gateway
          </button>
        </>
      )}

      {/* Segurar: fundo desfocado + cartão + cores + Deletar */}
      <AnimatePresence>
        {active && activeGw && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-black/50 p-6 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setActive(null)}
          >
            <motion.div
              className={`relative w-full max-w-sm overflow-hidden rounded-2xl bg-gradient-to-br text-white shadow-2xl ring-1 ring-white/20 ${gradOf(active, activeGw.color)}`}
              style={{ height: CARD_H }}
              initial={{ scale: 0.82, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={SPRING}
              onClick={(e) => e.stopPropagation()}
            >
              {cardInner(activeGw)}
            </motion.div>

            <motion.div
              className="flex max-w-sm flex-wrap items-center justify-center gap-2.5"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ ...SPRING, delay: 0.05 }}
              onClick={(e) => e.stopPropagation()}
            >
              {PALETTE.map((p) => {
                const selected = keyFor(active, activeGw.color) === p.key;
                return (
                  <button
                    key={p.key}
                    onClick={() => handleColor(active, p.key)}
                    aria-label={`Cor ${p.key}`}
                    className={`tap h-8 w-8 rounded-full bg-gradient-to-br ${p.grad} ${
                      selected ? "ring-2 ring-white ring-offset-2 ring-offset-transparent" : "ring-1 ring-white/25"
                    }`}
                  />
                );
              })}
            </motion.div>

            <motion.button
              onClick={() => handleDelete(active)}
              className="tap flex items-center gap-2 rounded-xl bg-destructive px-7 py-3 text-sm font-semibold text-destructive-foreground shadow-lg"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ ...SPRING, delay: 0.08 }}
            >
              <Trash2 className="h-4 w-4" />
              Deletar
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: adicionar gateway */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowAdd(false)}
          >
            <motion.div
              className="glass-strong w-full max-w-sm rounded-2xl p-5"
              initial={{ scale: 0.9, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={SPRING}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold">Adicionar gateway</h3>
                <button onClick={() => setShowAdd(false)} className="tap rounded-lg p-1 text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-3">
                <input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Nome do gateway (ex: Stripe)"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  type="password"
                  value={addSecret}
                  onChange={(e) => setAddSecret(e.target.value)}
                  placeholder="Secret key"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={handleAdd}
                  disabled={!addName.trim() || !addSecret.trim()}
                  className="tap flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
