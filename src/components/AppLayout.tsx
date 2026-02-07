import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Monitor, ShoppingCart, FileText, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";

const navItems = [
  { to: "/assets", label: "Assets", icon: Monitor },
  { to: "/orders", label: "Orders", icon: ShoppingCart },
  { to: "/audit-log", label: "Audit Log", icon: FileText },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { performedBy, setPerformedBy } = useAppStore();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <Link to="/" className="text-lg font-semibold text-foreground">
            IT Manager
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
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
          <div className="ml-auto flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <Input
              className="h-8 w-40 text-sm"
              placeholder="Your name"
              value={performedBy}
              onChange={(e) => setPerformedBy(e.target.value)}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
