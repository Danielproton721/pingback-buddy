import { DashboardStats } from "@/components/DashboardStats";
import { PaymentsTable } from "@/components/PaymentsTable";
import { NotificationBell } from "@/components/NotificationBell";
import { PushPrompt } from "@/components/PushPrompt";
import { GatewayOverview } from "@/components/GatewayOverview";
import { useGateway } from "@/contexts/GatewayContext";
import { ArrowLeft } from "lucide-react";
import { getGatewayIcon } from "@/components/GatewayIconPicker";

export default function Dashboard() {
  const { selectedGateway, setSelectedGateway, gateways } = useGateway();
  const selectedConfig = gateways.find((g) => g.name === selectedGateway);
  const displayLabel = selectedConfig?.display_name || selectedGateway;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {selectedGateway ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedGateway(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = getGatewayIcon(selectedConfig?.icon);
                  return (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                  );
                })()}
                <div>
                  <h1 className="text-xl md:text-2xl font-bold tracking-tight">{displayLabel}</h1>
                  <p className="text-xs md:text-sm text-muted-foreground truncate">Análise de vendas do gateway</p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-xs md:text-sm text-muted-foreground truncate">Visão geral dos gateways</p>
            </div>
          )}
        </div>
        <NotificationBell />
      </div>
      <PushPrompt />

      {selectedGateway ? (
        <>
          <DashboardStats gateway={selectedGateway} />
          <PaymentsTable gateway={selectedGateway} />
        </>
      ) : (
        <GatewayOverview />
      )}
    </div>
  );
}
