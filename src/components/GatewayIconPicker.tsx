import { useState } from "react";
import {
  CreditCard, Wallet, Banknote, DollarSign, Bitcoin,
  ShoppingCart, Store, Zap, Globe, Shield,
  Landmark, Receipt, BadgeDollarSign, CircleDollarSign,
  Smartphone, QrCode,
} from "lucide-react";

export const GATEWAY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "credit-card": CreditCard,
  wallet: Wallet,
  banknote: Banknote,
  "dollar-sign": DollarSign,
  bitcoin: Bitcoin,
  "shopping-cart": ShoppingCart,
  store: Store,
  zap: Zap,
  globe: Globe,
  shield: Shield,
  landmark: Landmark,
  receipt: Receipt,
  "badge-dollar": BadgeDollarSign,
  "circle-dollar": CircleDollarSign,
  smartphone: Smartphone,
  "qr-code": QrCode,
};

export function getGatewayIcon(iconName?: string | null) {
  return GATEWAY_ICONS[iconName || "credit-card"] || CreditCard;
}

interface GatewayIconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

export function GatewayIconPicker({ value, onChange }: GatewayIconPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-background hover:bg-secondary transition-colors"
        title="Escolher ícone"
      >
        {(() => {
          const Icon = getGatewayIcon(value);
          return <Icon className="h-4 w-4 text-primary" />;
        })()}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 grid grid-cols-4 gap-1 rounded-xl border border-border bg-card p-2 shadow-xl">
            {Object.entries(GATEWAY_ICONS).map(([key, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                  value === key
                    ? "bg-primary/20 text-primary ring-1 ring-primary/50"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
