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
  RECEIVED: "bg-status-received/15 text-status-received",
  CANCELLED: "bg-status-cancelled/15 text-status-cancelled",
};

export function StatusBadge({
  status,
  type,
}: {
  status: string;
  type: "asset" | "order";
}) {
  const colors = type === "asset" ? assetStatusColors : orderStatusColors;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        colors[status] || "bg-muted text-muted-foreground"
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
