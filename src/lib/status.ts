export const assetStatusLabels: Record<string, string> = {
  IN_STOCK: "Available",
  ASSIGNED: "Assigned",
  IN_REPAIR: "In repair",
  RETIRED: "Retired",
};

export const orderStatusLabels: Record<string, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  ORDERED: "Ordered",
  SHIPPED: "Shipped",
  READY_FOR_PICKUP: "Ready For Pickup",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

export function formatStatusFallback(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

export function getOrderStatusLabel(value: string): string {
  return orderStatusLabels[value] ?? formatStatusFallback(value);
}

export function getAssetStatusLabel(value: string): string {
  return assetStatusLabels[value] ?? formatStatusFallback(value);
}
