import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const assetStatusLabels: Record<string, string> = {
  IN_STOCK: "Available",
  ASSIGNED: "Assigned",
  IN_REPAIR: "In repair",
  RETIRED: "Retired",
};

const orderStatusLabels: Record<string, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  ORDERED: "Ordered",
  SHIPPED: "Shipped",
  READY_FOR_PICKUP: "Ready For Pickup",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

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

const formatFallback = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");

export function StatusBadge({
  kind,
  value,
}: {
  kind: "asset" | "order";
  value: string;
}) {
  const labels = kind === "asset" ? assetStatusLabels : orderStatusLabels;
  const colors = kind === "asset" ? assetStatusColors : orderStatusColors;
  const label = labels[value] ?? formatFallback(value);

  return (
    <Badge className={cn("border-transparent", colors[value] || "bg-muted text-muted-foreground")}>
      {label}
    </Badge>
  );
}
