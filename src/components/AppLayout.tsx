import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Webhook, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "./AppSidebar";
import { MobileTabBar } from "./MobileTabBar";
import { useIsMobile } from "@/hooks/use-mobile";

export function AppLayout() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="min-h-screen">
        <header className="glass-nav sticky top-0 z-30 flex items-center gap-3 px-4 pt-safe pb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary glow-primary">
            <Webhook className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">PayHook</span>
          <button
            onClick={handleLogout}
            aria-label="Sair"
            className="tap ml-auto rounded-xl p-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </header>
        <main className="px-4 pb-28 pt-4">
          <div className="mx-auto max-w-2xl">
            <Outlet />
          </div>
        </main>
        <MobileTabBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppSidebar />
      <main className="pl-64">
        <div className="mx-auto max-w-6xl p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
