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
    <nav className="glass-nav fixed bottom-0 left-0 right-0 z-40 pb-safe">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-1.5">
        {items.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => {
                if (item.path === "/") setSelectedGateway(null);
              }}
              className={`tap flex flex-1 flex-col items-center gap-1 py-1 text-[10px] font-medium ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                  active ? "bg-primary/15" : ""
                }`}
              >
                <item.icon className="h-5 w-5" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
