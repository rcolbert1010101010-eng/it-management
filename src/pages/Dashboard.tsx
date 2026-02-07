import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAssets, fetchOrders } from "@/lib/api";
import { Monitor, ShoppingCart, Package, AlertTriangle } from "lucide-react";

export default function Dashboard() {
  const { data: assets } = useQuery({
    queryKey: ["assets"],
    queryFn: () => fetchAssets(),
  });

  const { data: orders } = useQuery({
    queryKey: ["orders"],
    queryFn: () => fetchOrders(),
  });

  const totalAssets = assets?.length || 0;
  const assignedAssets = assets?.filter((a) => a.status === "ASSIGNED").length || 0;
  const inRepair = assets?.filter((a) => a.status === "IN_REPAIR").length || 0;
  const totalOrders = orders?.length || 0;
  const pendingOrders = orders?.filter((o) => !["RECEIVED", "CANCELLED"].includes(o.status)).length || 0;

  const stats = [
    {
      label: "Total Assets",
      value: totalAssets,
      icon: Monitor,
      to: "/assets",
      color: "text-primary",
    },
    {
      label: "Assigned",
      value: assignedAssets,
      icon: Package,
      to: "/assets",
      color: "text-status-assigned",
    },
    {
      label: "In Repair",
      value: inRepair,
      icon: AlertTriangle,
      to: "/assets",
      color: "text-status-in-repair",
    },
    {
      label: "Active Orders",
      value: pendingOrders,
      icon: ShoppingCart,
      to: "/orders",
      color: "text-status-ordered",
    },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, to, color }) => (
          <Link
            key={label}
            to={to}
            className="rounded-lg border bg-card p-6 transition-colors hover:bg-accent"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{label}</p>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Recent Assets */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-foreground">Recent Assets</h2>
            <Link to="/assets" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          {assets?.slice(0, 5).map((asset) => (
            <div key={asset.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <Link to={`/assets/${asset.id}`} className="text-sm font-medium text-primary hover:underline">
                  {asset.asset_tag}
                </Link>
                <p className="text-xs text-muted-foreground capitalize">
                  {asset.category} {asset.model ? `• ${asset.model}` : ""}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{asset.status.replace(/_/g, " ")}</span>
            </div>
          )) || <p className="text-sm text-muted-foreground">No assets yet</p>}
        </div>

        {/* Recent Orders */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-foreground">Recent Orders</h2>
            <Link to="/orders" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          {orders?.slice(0, 5).map((order) => (
            <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <Link to={`/orders/${order.id}`} className="text-sm font-medium text-primary hover:underline">
                  {order.order_number}
                </Link>
                <p className="text-xs text-muted-foreground">{order.vendor_name}</p>
              </div>
              <span className="text-xs text-muted-foreground">{order.status}</span>
            </div>
          )) || <p className="text-sm text-muted-foreground">No orders yet</p>}
        </div>
      </div>
    </div>
  );
}
