import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { BarChart3, LayoutDashboard, Monitor, ShoppingCart, FileText, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/assets", label: "Assets", icon: Monitor },
  { to: "/orders", label: "Orders", icon: ShoppingCart },
  { to: "/audit-log", label: "Audit Log", icon: FileText },
  { to: "/reports", label: "Reports", icon: BarChart3 },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { performedBy, setPerformedBy } = useAppStore();
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHasSession(!!data.session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setHasSession(!!session);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (location.pathname.startsWith("/login")) {
    return <div className="w-full">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="flex h-14 items-center px-4">
          <div className="text-lg font-semibold text-foreground">IT Management</div>
          <div className="ml-auto flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <Input
              className="h-8 w-40 text-sm"
              placeholder="Your name"
              value={performedBy}
              onChange={(e) => setPerformedBy(e.target.value)}
            />
            {hasSession ? (
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign out
              </Button>
            ) : null}
          </div>
        </div>
      </header>
      <div className="flex">
        <aside className="w-64 border-r bg-card">
          <nav className="flex flex-col gap-1 p-4">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  location.pathname.startsWith(to)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 px-4 py-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
