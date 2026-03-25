import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

export type Asset = Database["public"]["Tables"]["assets"]["Row"];
export type AssetInsert = Database["public"]["Tables"]["assets"]["Insert"];
export type AssetUpdate = Database["public"]["Tables"]["assets"]["Update"];
export type Location = Database["public"]["Tables"]["locations"]["Row"];
export type LocationInsert = Database["public"]["Tables"]["locations"]["Insert"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];
export type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];
export type OrderLineItem = Database["public"]["Tables"]["order_line_items"]["Row"];
export type OrderLineItemInsert = Database["public"]["Tables"]["order_line_items"]["Insert"];
export type OrderLineItemUpdate = Database["public"]["Tables"]["order_line_items"]["Update"];
export type AuditLogEntry = Database["public"]["Tables"]["audit_log"]["Row"];

export const ASSET_CATEGORIES = [
  "laptop", "desktop", "monitor", "phone", "printer", "server", "network", "other",
] as const;

export const ASSET_STATUSES = ["IN_STOCK", "ASSIGNED", "IN_REPAIR", "RETIRED"] as const;

export const ORDER_STATUSES = [
  "REQUESTED", "APPROVED", "ORDERED", "SHIPPED", "READY_FOR_PICKUP", "RECEIVED", "CANCELLED",
] as const;

const ASSET_SELECT = [
  "id",
  "asset_tag",
  "assigned_to_email",
  "assigned_to_name",
  "category",
  "created_at",
  "is_consumable",
  "last_logged_in_date",
  "last_reimaged_date",
  "location",
  "manufacturer",
  "model",
  "notes",
  "purchase_date",
  "quantity_on_hand",
  "serial_number",
  "specific_location",
  "source_order_id",
  "source_order_line_item_id",
  "status",
  "updated_at",
  "warranty_end_date",
].join(",");

export function trimLocationName(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function normalizeLocationName(value: string | null | undefined) {
  return trimLocationName(value).toLowerCase();
}

export function findMatchingLocation(value: string | null | undefined, locations: Location[]) {
  const normalized = normalizeLocationName(value);
  if (!normalized) return null;
  return locations.find((location) => normalizeLocationName(location.name) === normalized) ?? null;
}

export function mergeLocations(locations: Location[]) {
  const deduped = new Map<string, Location>();

  for (const location of locations) {
    const normalized = normalizeLocationName(location.name);
    if (!normalized || deduped.has(normalized)) continue;
    deduped.set(normalized, {
      ...location,
      name: trimLocationName(location.name),
    });
  }

  return [...deduped.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeQuantityOnHand(value: number | null | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.trunc(value));
}

function normalizeReceivedQuantity(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

export async function fetchLocations() {
  const { data, error } = await supabase.from("locations").select("*").order("name", { ascending: true });
  if (error) throw error;
  return mergeLocations(data);
}

async function findExistingLocationByName(name: string) {
  const trimmedName = trimLocationName(name);
  if (!trimmedName) return null;

  const { data, error } = await supabase.from("locations").select("*").order("name", { ascending: true });
  if (error) throw error;

  return findMatchingLocation(trimmedName, mergeLocations(data));
}

export async function createLocation(name: string) {
  const trimmedName = trimLocationName(name);
  if (!trimmedName) {
    throw new Error("Location is required.");
  }

  const existingLocation = await findExistingLocationByName(trimmedName);
  if (existingLocation) {
    return existingLocation;
  }

  const payload: LocationInsert = { name: trimmedName };
  const { data, error } = await supabase.from("locations").insert(payload).select("*").single();

  if (error) {
    if (error.code === "23505") {
      const duplicate = await findExistingLocationByName(trimmedName);
      if (duplicate) return duplicate;
    }

    throw error;
  }

  return data;
}

// ---- Assets ----

export async function fetchAssets(params?: {
  search?: string;
  status?: string;
  category?: string;
}) {
  let query = supabase.from("assets").select(ASSET_SELECT).order("created_at", { ascending: false });

  if (params?.status) {
    query = query.eq("status", params.status);
  }
  if (params?.category) {
    query = query.eq("category", params.category);
  }
  if (params?.search) {
    const s = `%${params.search}%`;
    query = query.or(`asset_tag.ilike.${s},serial_number.ilike.${s},assigned_to_name.ilike.${s},assigned_to_email.ilike.${s}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchAsset(id: string) {
  const { data, error } = await supabase.from("assets").select(ASSET_SELECT).eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createAsset(asset: AssetInsert, performedBy: string) {
  const defaultQuantity = 1;
  const payload: AssetInsert = {
    ...asset,
    is_consumable: asset.is_consumable ?? false,
    location: trimLocationName(asset.location) || null,
    quantity_on_hand: normalizeQuantityOnHand(asset.quantity_on_hand, defaultQuantity),
    specific_location: trimLocationName(asset.specific_location) || null,
  };
  const { data, error } = await supabase.from("assets").insert(payload).select(ASSET_SELECT).single();
  if (error) {
    if (error.code === "23505") {
      throw new Error("An asset with this asset tag already exists.");
    }
    if (error.code === "23514") {
      throw new Error("Quantity On Hand must be a non-negative whole number.");
    }
    throw error;
  }
  await logAudit("ASSET", data.id, "CREATED", { asset_tag: data.asset_tag }, performedBy);
  return data;
}

export async function updateAsset(id: string, updates: AssetUpdate, performedBy: string) {
  const { data: old, error: fetchOldError } = await supabase
    .from("assets")
    .select("status,is_consumable,quantity_on_hand")
    .eq("id", id)
    .single();
  if (fetchOldError) throw fetchOldError;

  const nextIsConsumable = updates.is_consumable ?? old.is_consumable;
  const defaultQuantity = nextIsConsumable ? old.quantity_on_hand : 1;
  const payload: AssetUpdate = {
    ...updates,
    location: updates.location === undefined ? undefined : trimLocationName(updates.location) || null,
    quantity_on_hand: normalizeQuantityOnHand(updates.quantity_on_hand, defaultQuantity),
    specific_location:
      updates.specific_location === undefined ? undefined : trimLocationName(updates.specific_location) || null,
  };

  const { data, error } = await supabase
    .from("assets")
    .update(payload)
    .eq("id", id)
    .select(ASSET_SELECT)
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new Error("An asset with this asset tag already exists.");
    }
    if (error.code === "23514") {
      throw new Error("Quantity On Hand must be a non-negative whole number.");
    }
    throw error;
  }
  const action = old?.status !== data.status ? "STATUS_CHANGED" : "UPDATED";
  await logAudit("ASSET", data.id, action, {
    asset_tag: data.asset_tag,
    ...(action === "STATUS_CHANGED" ? { from: old?.status, to: data.status } : {}),
  }, performedBy);
  return data;
}

export async function deleteAsset(id: string, performedBy: string) {
  const { data } = await supabase.from("assets").select("asset_tag").eq("id", id).single();
  const { error } = await supabase.from("assets").delete().eq("id", id);
  if (error) throw error;
  await logAudit("ASSET", id, "DELETED", { asset_tag: data?.asset_tag }, performedBy);
}

// ---- Orders ----

export async function fetchOrders(params?: { search?: string; status?: string }) {
  let query = supabase.from("orders").select("*").order("created_at", { ascending: false });

  if (params?.status) {
    query = query.eq("status", params.status);
  }
  if (params?.search) {
    const s = `%${params.search}%`;
    query = query.or(`order_number.ilike.${s},vendor_name.ilike.${s}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchOrder(id: string) {
  const { data, error } = await supabase.from("orders").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function fetchOrderLineItems(orderId: string) {
  const { data, error } = await supabase
    .from("order_line_items")
    .select("*")
    .eq("order_id", orderId)
    .order("item_name");
  if (error) throw error;
  return data;
}

export async function createOrder(
  order: OrderInsert,
  lineItems: Omit<OrderLineItemInsert, "order_id">[],
  performedBy: string
) {
  const { data, error } = await supabase.from("orders").insert(order).select().single();
  if (error) {
    if (error.code === "23505") throw new Error("An order with this order number already exists.");
    throw error;
  }

  if (lineItems.length > 0) {
    const items = lineItems.map((li) => ({ ...li, order_id: data.id }));
    const { error: liError } = await supabase.from("order_line_items").insert(items);
    if (liError) throw liError;
  }

  await logAudit("ORDER", data.id, "CREATED", { order_number: data.order_number }, performedBy);
  return data;
}

export async function updateOrder(
  id: string,
  updates: OrderUpdate,
  performedBy: string
) {
  const { data: old } = await supabase.from("orders").select("status").eq("id", id).single();
  const { data, error } = await supabase.from("orders").update(updates).eq("id", id).select().single();
  if (error) {
    if (error.code === "23505") throw new Error("An order with this order number already exists.");
    throw error;
  }
  const action = old?.status !== data.status ? "STATUS_CHANGED" : "UPDATED";
  await logAudit("ORDER", data.id, action, {
    order_number: data.order_number,
    ...(action === "STATUS_CHANGED" ? { from: old?.status, to: data.status } : {}),
  }, performedBy);
  return data;
}

export async function deleteOrder(id: string, performedBy: string) {
  const { data } = await supabase.from("orders").select("order_number").eq("id", id).single();
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw error;
  await logAudit("ORDER", id, "DELETED", { order_number: data?.order_number }, performedBy);
}

export async function upsertOrderLineItems(
  orderId: string,
  lineItems: OrderLineItemInsert[]
) {
  // Delete existing, then insert new
  await supabase.from("order_line_items").delete().eq("order_id", orderId);
  if (lineItems.length > 0) {
    const items = lineItems.map((li) => ({ ...li, order_id: orderId }));
    const { error } = await supabase.from("order_line_items").insert(items);
    if (error) throw error;
  }
}

async function applyConsumableInventoryDeltaForReceipt(
  orderId: string,
  lineItem: OrderLineItem,
  desiredTotalReceived: number,
  performedBy: string
) {
  if (desiredTotalReceived <= 0) return;

  const { data: ledgerRow, error: ledgerReadError } = await supabase
    .from("order_line_item_receipt_ledger")
    .select("order_line_item_id,total_received_applied")
    .eq("order_line_item_id", lineItem.id)
    .maybeSingle();
  if (ledgerReadError) throw ledgerReadError;

  const alreadyApplied = normalizeReceivedQuantity(ledgerRow?.total_received_applied);
  const delta = desiredTotalReceived - alreadyApplied;
  if (delta <= 0) return;

  const { data: existingConsumableAsset, error: assetLookupError } = await supabase
    .from("assets")
    .select(ASSET_SELECT)
    .eq("source_order_id", orderId)
    .eq("source_order_line_item_id", lineItem.id)
    .eq("is_consumable", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (assetLookupError) throw assetLookupError;

  let adjustedAsset: Asset;
  let previousQuantityOnHand = 0;
  let createdAsset = false;

  if (existingConsumableAsset) {
    previousQuantityOnHand = normalizeQuantityOnHand(existingConsumableAsset.quantity_on_hand, 0);
    const { data: updatedAsset, error: updateAssetError } = await supabase
      .from("assets")
      .update({ quantity_on_hand: previousQuantityOnHand + delta })
      .eq("id", existingConsumableAsset.id)
      .select(ASSET_SELECT)
      .single();
    if (updateAssetError) throw updateAssetError;
    adjustedAsset = updatedAsset;
  } else {
    const { data: insertedAsset, error: insertAssetError } = await supabase
      .from("assets")
      .insert({
        asset_tag: null,
        category: "other",
        is_consumable: true,
        model: lineItem.item_name,
        notes: lineItem.notes || "Auto-created from received order line item",
        quantity_on_hand: delta,
        source_order_id: orderId,
        source_order_line_item_id: lineItem.id,
        status: "IN_STOCK",
      })
      .select(ASSET_SELECT)
      .single();
    if (insertAssetError) throw insertAssetError;
    adjustedAsset = insertedAsset;
    createdAsset = true;
  }

  const { error: ledgerWriteError } = await supabase
    .from("order_line_item_receipt_ledger")
    .upsert(
      {
        order_line_item_id: lineItem.id,
        total_received_applied: desiredTotalReceived,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "order_line_item_id" }
    );

  if (ledgerWriteError) {
    if (createdAsset) {
      await supabase.from("assets").delete().eq("id", adjustedAsset.id);
    } else {
      await supabase
        .from("assets")
        .update({ quantity_on_hand: previousQuantityOnHand })
        .eq("id", adjustedAsset.id);
    }
    throw ledgerWriteError;
  }

  await logAudit(
    "ASSET",
    adjustedAsset.id,
    "QOH_INCREMENTED",
    {
      source_order_id: orderId,
      source_order_line_item_id: lineItem.id,
      line_item_name: lineItem.item_name,
      delta,
      previous_quantity_on_hand: previousQuantityOnHand,
      quantity_on_hand: adjustedAsset.quantity_on_hand,
      received_total_requested: desiredTotalReceived,
      received_total_previously_applied: alreadyApplied,
    },
    performedBy
  );
}

export async function markOrderReceived(
  orderId: string,
  lineItemUpdates: { id: string; received_quantity: number | null }[],
  performedBy: string
) {
  const { data: currentOrder, error: currentOrderError } = await supabase
    .from("orders")
    .select("received_date")
    .eq("id", orderId)
    .single();
  if (currentOrderError) throw currentOrderError;

  const receivedDate = currentOrder.received_date || new Date().toISOString().split("T")[0];
  const { error: orderError } = await supabase
    .from("orders")
    .update({ status: "RECEIVED", received_date: receivedDate })
    .eq("id", orderId);
  if (orderError) throw orderError;

  for (const li of lineItemUpdates) {
    const desiredTotalReceived = normalizeReceivedQuantity(li.received_quantity);

    const { data: updatedLineItem, error: lineItemError } = await supabase
      .from("order_line_items")
      .update({ received_quantity: desiredTotalReceived })
      .eq("id", li.id)
      .eq("order_id", orderId)
      .select("*")
      .single();

    if (lineItemError) {
      throw lineItemError;
    }

    try {
      await applyConsumableInventoryDeltaForReceipt(
        orderId,
        updatedLineItem,
        desiredTotalReceived,
        performedBy
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed inventory adjustment for line item "${updatedLineItem.item_name}": ${reason}`);
    }
  }

  const { data: order } = await supabase.from("orders").select("order_number").eq("id", orderId).single();
  await logAudit("ORDER", orderId, "RECEIVED", { order_number: order?.order_number }, performedBy);
}

// ---- Create Assets from Line Item ----

export async function createAssetsFromLineItem(
  orderId: string,
  lineItemId: string,
  assetTags: string[],
  category: string,
  performedBy: string
) {
  const { data: lineItem } = await supabase
    .from("order_line_items")
    .select("*")
    .eq("id", lineItemId)
    .single();
  if (!lineItem) throw new Error("Line item not found");

  const assets: AssetInsert[] = assetTags.map((tag) => ({
    asset_tag: tag,
    category,
    model: lineItem.item_name,
    quantity_on_hand: 1,
    source_order_id: orderId,
    source_order_line_item_id: lineItemId,
    status: "IN_STOCK",
  }));

  const { data, error } = await supabase.from("assets").insert(assets).select(ASSET_SELECT);
  if (error) {
    if (error.code === "23505") throw new Error("One or more asset tags already exist.");
    throw error;
  }

  for (const asset of data) {
    await logAudit("ASSET", asset.id, "CREATED", {
      asset_tag: asset.asset_tag,
      source_order_id: orderId,
      source_order_line_item_id: lineItemId,
    }, performedBy);
  }

  return data;
}

// ---- Audit Log ----

async function logAudit(
  entityType: string,
  entityId: string,
  action: string,
  details: Record<string, unknown>,
  performedBy: string
) {
  await supabase.from("audit_log").insert({
    entity_type: entityType,
    entity_id: entityId,
    action,
    details: details as Json,
    performed_by: performedBy || "system",
  });
}

export async function fetchAuditLog(params?: { entityType?: string; entityId?: string }) {
  let query = supabase.from("audit_log").select("*").order("timestamp", { ascending: false }).limit(200);

  if (params?.entityType) {
    query = query.eq("entity_type", params.entityType);
  }
  if (params?.entityId) {
    query = query.eq("entity_id", params.entityId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
