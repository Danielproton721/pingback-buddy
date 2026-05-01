import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { fetchGatewayConfigs, type GatewayConfig } from "@/lib/supabase-helpers";

interface GatewayContextType {
  gateways: GatewayConfig[];
  selectedGateway: string | null; // gateway name or null for "all"
  setSelectedGateway: (name: string | null) => void;
  loading: boolean;
  refreshGateways: () => Promise<void>;
}

const GatewayContext = createContext<GatewayContextType | null>(null);

export function GatewayProvider({ children }: { children: ReactNode }) {
  const [gateways, setGateways] = useState<GatewayConfig[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshGateways = async () => {
    const { data } = await fetchGatewayConfigs();
    if (data) setGateways(data as unknown as GatewayConfig[]);
    setLoading(false);
  };

  useEffect(() => {
    refreshGateways();
  }, []);

  return (
    <GatewayContext.Provider value={{ gateways, selectedGateway, setSelectedGateway, loading, refreshGateways }}>
      {children}
    </GatewayContext.Provider>
  );
}

export function useGateway() {
  const ctx = useContext(GatewayContext);
  if (!ctx) throw new Error("useGateway must be used within GatewayProvider");
  return ctx;
}
