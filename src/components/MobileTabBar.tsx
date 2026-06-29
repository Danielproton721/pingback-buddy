import { useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Player } from "@lordicon/react";
import { useGateway } from "@/contexts/GatewayContext";
import homeIcon from "@/assets/lottie/home.json";
import clockIcon from "@/assets/lottie/clock.json";
import bellIcon from "@/assets/lottie/bell.json";
import cogIcon from "@/assets/lottie/cog.json";

// Cores aproximadas do tema (primary cyan / muted-foreground)
const ACTIVE_COLOR = "#2cc9d9";
const INACTIVE_COLOR = "#6b7488";

const items = [
  { icon: homeIcon, label: "Início", path: "/" },
  { icon: clockIcon, label: "Logs", path: "/logs" },
  { icon: bellIcon, label: "Alertas", path: "/notifications" },
  { icon: cogIcon, label: "Ajustes", path: "/settings" },
];

interface TabItemProps {
  icon: object;
  label: string;
  path: string;
  active: boolean;
  onSelect: () => void;
}

function TabItem({ icon, label, path, active, onSelect }: TabItemProps) {
  const playerRef = useRef<Player>(null);

  return (
    <Link
      to={path}
      onClick={() => {
        onSelect();
        playerRef.current?.playFromBeginning();
      }}
      className={`tap flex flex-1 flex-col items-center gap-0.5 rounded-full py-1 text-[10px] font-medium transition-colors ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <Player
        ref={playerRef}
        icon={icon}
        size={26}
        colorize={active ? ACTIVE_COLOR : INACTIVE_COLOR}
      />
      <span>{label}</span>
    </Link>
  );
}

export function MobileTabBar() {
  const location = useLocation();
  const { setSelectedGateway } = useGateway();

  return (
    <>
      {/* Filtro SVG de distorção (liquid glass) */}
      <svg width="0" height="0" aria-hidden="true" className="absolute">
        <filter id="glass-distortion" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.009 0.009" numOctaves="2" seed="5" result="turbulence" />
          <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
          <feDisplacementMap in="SourceGraphic" in2="softMap" scale="34" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-safe">
        <div className="glass-pill-frame pointer-events-auto relative mx-auto mb-1 max-w-md overflow-hidden rounded-full">
          <div className="liquid-effect absolute inset-0" aria-hidden="true" />
          {/* borda branca fina — fica ACIMA do efeito líquido para não ser coberta */}
          <div className="pointer-events-none absolute inset-0 z-20 rounded-full ring-1 ring-inset ring-white/35" aria-hidden="true" />
          <div className="relative z-10 flex items-center justify-around gap-0.5 px-2 py-2">
            {items.map((item) => (
              <TabItem
                key={item.path}
                icon={item.icon}
                label={item.label}
                path={item.path}
                active={location.pathname === item.path}
                onSelect={() => {
                  if (item.path === "/") setSelectedGateway(null);
                }}
              />
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}
