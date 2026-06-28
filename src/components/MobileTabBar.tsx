import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Webhook, Bell, Settings, Bug } from "lucide-react";
import { useGateway } from "@/contexts/GatewayContext";

const items = [
  { icon: LayoutDashboard, label: "Início", path: "/" },
  { icon: Webhook, label: "Logs", path: "/logs" },
  { icon: Bell, label: "Alertas", path: "/notifications" },
  { icon: Settings, label: "Ajustes", path: "/settings" },
  { icon: Bug, label: "Debug", path: "/debug" },
];

export function MobileTabBar() {
  const location = useLocation();
  const { setSelectedGateway } = useGateway();

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-safe">
      <div className="glass-pill pointer-events-auto mx-auto mb-1 flex max-w-md items-center justify-around gap-0.5 rounded-full px-2 py-2">
        {items.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => {
                if (item.path === "/") setSelectedGateway(null);
              }}
              className={`tap flex flex-1 flex-col items-center gap-0.5 rounded-full py-1 text-[10px] font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
