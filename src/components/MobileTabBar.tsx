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
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-safe">
      <div className="glass-pill pointer-events-auto mx-auto mb-1 flex max-w-md items-center justify-around gap-0.5 rounded-full px-2 py-2">
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
    </nav>
  );
}
