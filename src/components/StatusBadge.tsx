import { Badge } from "@/components/ui/badge";
import { getAssetStatusLabel, getOrderStatusLabel } from "@/lib/status";
import { cn } from "@/lib/utils";

const assetStatusColors: Record<string, string> = {
  IN_STOCK: "bg-status-in-stock/15 text-status-in-stock",
  ASSIGNED: "bg-status-assigned/15 text-status-assigned",
  IN_REPAIR: "bg-status-in-repair/15 text-status-in-repair",
  RETIRED: "bg-status-retired/15 text-status-retired",
};

const orderStatusColors: Record<string, string> = {
  REQUESTED: "bg-status-requested/15 text-status-requested",
  APPROVED: "bg-status-approved/15 text-status-approved",
  ORDERED: "bg-status-ordered/15 text-status-ordered",
  SHIPPED: "bg-status-shipped/15 text-status-shipped",
  READY_FOR_PICKUP: "bg-status-shipped/15 text-status-shipped",
  RECEIVED: "bg-status-received/15 text-status-received",
  CANCELLED: "bg-status-cancelled/15 text-status-cancelled",
};

export function StatusBadge({
  kind,
  value,
}: {
  kind: "asset" | "order";
  value: string;
}) {
  const colors = kind === "asset" ? assetStatusColors : orderStatusColors;
  const label = kind === "asset" ? getAssetStatusLabel(value) : getOrderStatusLabel(value);

  return (
    <Badge className={cn("border-transparent", colors[value] || "bg-muted text-muted-foreground")}>
      {label}
    </Badge>
  );
}
