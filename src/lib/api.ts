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
export type OrderLineItemInput = Omit<OrderLineItemInsert, "order_id"> & {
  asset_tag?: string | null;
};

export const ASSET_CATEGORIES = [
  "laptop", "desktop", "monitor", "phone", "printer", "server", "network", "other",
] as const;

export const ASSET_STATUSES = ["IN_STOCK", "ASSIGNED", "IN_REPAIR", "RETIRED"] as const;

export const ORDER_STATUSES = [
  "REQUESTED", "APPROVED", "ORDERED", "SHIPPED", "READY_FOR_PICKUP", "RECEIVED", "CANCELLED",
] as const;

const GENERATED_FROM_ORDER_MARKER = "[generated-from-order-line-item]";

export type OrderLineItemAssetLink = Pick<
  Asset,
  | "id"
  | "asset_tag"
  | "category"
  | "created_at"
  | "is_consumable"
  | "model"
  | "quantity_on_hand"
  | "source_order_line_item_id"
  | "status"
> & {
  generated_from_order: boolean;
};

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

function inferAssetCategoryFromLineItemName(itemName: string) {
  const normalized = itemName.toLowerCase();
  if (normalized.includes("laptop")) return "laptop";
  if (normalized.includes("desktop")) return "desktop";
  if (normalized.includes("monitor") || normalized.includes("display")) return "monitor";
  if (normalized.includes("phone")) return "phone";
  if (normalized.includes("printer")) return "printer";
  if (normalized.includes("server")) return "server";
  if (
    normalized.includes("switch")
    || normalized.includes("router")
    || normalized.includes("firewall")
    || normalized.includes("ap ")
    || normalized.includes("wireless")
    || normalized.includes("network")
  ) {
    return "network";
  }
  return "other";
}

function normalizeAssetTagInput(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function formatAssetTagTimestamp(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function randomAssetTagSuffix(length: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
}

function createUuid() {
  return crypto.randomUUID();
}

async function ensureUniqueAssetTag(preferredAssetTag: string | null) {
  if (preferredAssetTag) {
    const { data: existingAsset, error: existingAssetError } = await supabase
      .from("assets")
      .select("id")
      .eq("asset_tag", preferredAssetTag)
      .limit(1)
      .maybeSingle();
    if (existingAssetError) throw existingAssetError;
    if (existingAsset) throw new Error(`Asset tag "${preferredAssetTag}" already exists.`);
    return preferredAssetTag;
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const generatedAssetTag = `ASSET-${formatAssetTagTimestamp(new Date())}-${randomAssetTagSuffix(4)}`;
    const { data: existingAsset, error: existingAssetError } = await supabase
      .from("assets")
      .select("id")
      .eq("asset_tag", generatedAssetTag)
      .limit(1)
      .maybeSingle();
    if (existingAssetError) throw existingAssetError;
    if (!existingAsset) return generatedAssetTag;
  }

  throw new Error("Unable to generate a unique asset tag. Please retry.");
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

export async function fetchAssetCategories() {
  const { data, error } = await supabase.from("assets").select("category").order("category");
  if (error) throw error;

  const categoriesByKey = new Map<string, string>();
  for (const category of ASSET_CATEGORIES) {
    categoriesByKey.set(category.toLowerCase(), category);
  }
  for (const row of data ?? []) {
    const normalized = row.category?.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (!categoriesByKey.has(key)) {
      categoriesByKey.set(key, normalized);
    }
  }

  return [...categoriesByKey.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
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

export type AssetBulkUpdate = Partial<
  Pick<
    AssetUpdate,
    | "status"
    | "category"
    | "location"
    | "specific_location"
    | "assigned_to_name"
    | "assigned_to_email"
    | "last_reimaged_date"
    | "last_logged_in_date"
  >
>;

export type BulkMutationResult = {
  succeeded: number;
  failed: number;
  errors: string[];
};

export async function bulkUpdateAssets(ids: string[], updates: AssetBulkUpdate, performedBy: string) {
  if (ids.length === 0) {
    return { updated: 0 };
  }

  const payload: AssetUpdate = {};
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.location !== undefined) payload.location = trimLocationName(updates.location) || null;
  if (updates.specific_location !== undefined) {
    payload.specific_location = trimLocationName(updates.specific_location) || null;
  }
  if (updates.assigned_to_name !== undefined) payload.assigned_to_name = updates.assigned_to_name || null;
  if (updates.assigned_to_email !== undefined) payload.assigned_to_email = updates.assigned_to_email || null;
  if (updates.last_reimaged_date !== undefined) payload.last_reimaged_date = updates.last_reimaged_date || null;
  if (updates.last_logged_in_date !== undefined) payload.last_logged_in_date = updates.last_logged_in_date || null;

  if (Object.keys(payload).length === 0) {
    throw new Error("Select at least one field to update.");
  }

  const { data, error } = await supabase.from("assets").update(payload).in("id", ids).select("id,asset_tag,status");
  if (error) throw error;

  const changedFields = Object.keys(payload);
  for (const asset of data ?? []) {
    await logAudit(
      "ASSET",
      asset.id,
      "BULK_UPDATED",
      {
        asset_tag: asset.asset_tag,
        bulk: true,
        changed_fields: changedFields,
        updates: payload,
      },
      performedBy
    );
  }

  return { updated: data?.length ?? 0 };
}

export async function bulkDeleteAssets(ids: string[], performedBy: string): Promise<BulkMutationResult> {
  const result: BulkMutationResult = { succeeded: 0, failed: 0, errors: [] };

  for (const id of ids) {
    try {
      await deleteAsset(id, performedBy);
      result.succeeded += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
    }
  }

  if (result.succeeded === 0 && result.failed > 0) {
    throw new Error(result.errors[0] ?? "Failed to delete selected assets.");
  }

  return result;
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

export async function fetchOrderLineItemAssetLinks(orderId: string): Promise<OrderLineItemAssetLink[]> {
  const { data, error } = await supabase
    .from("assets")
    .select("id,asset_tag,category,created_at,is_consumable,model,notes,quantity_on_hand,source_order_line_item_id,status")
    .eq("source_order_id", orderId)
    .not("source_order_line_item_id", "is", null)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (data ?? [])
    .filter((asset): asset is typeof asset & { source_order_line_item_id: string } => !!asset.source_order_line_item_id)
    .map((asset) => ({
      id: asset.id,
      asset_tag: asset.asset_tag,
      category: asset.category,
      created_at: asset.created_at,
      generated_from_order: (asset.notes || "").includes(GENERATED_FROM_ORDER_MARKER),
      is_consumable: asset.is_consumable,
      model: asset.model,
      quantity_on_hand: asset.quantity_on_hand,
      source_order_line_item_id: asset.source_order_line_item_id,
      status: asset.status,
    }));
}

export async function createOrder(
  order: OrderInsert,
  lineItems: OrderLineItemInput[],
  performedBy: string
) {
  const { data, error } = await supabase.from("orders").insert(order).select().single();
  if (error) {
    if (error.code === "23505") throw new Error("An order with this order number already exists.");
    throw error;
  }

  const assetTagsByLineItemId: Record<string, string | null> = {};
  if (lineItems.length > 0) {
    const items = lineItems.map(({ asset_tag: _assetTag, id: _id, ...li }) => ({
      ...li,
      id: createUuid(),
      order_id: data.id,
    }));
    const { data: insertedLineItems, error: liError } = await supabase.from("order_line_items").insert(items).select("*");
    if (liError) throw liError;

    insertedLineItems?.forEach((lineItem, index) => {
      assetTagsByLineItemId[lineItem.id] = lineItems[index]?.asset_tag ?? null;
    });
  }

  await generateMissingAssetsForOrderLineItems(data.id, performedBy, assetTagsByLineItemId);
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

export type OrderBulkUpdate = Partial<
  Pick<
    OrderUpdate,
    | "status"
    | "vendor_name"
    | "requested_by_name"
    | "requested_by_email"
    | "order_date"
    | "expected_delivery_date"
    | "received_date"
    | "notes"
  >
>;

export async function bulkUpdateOrders(ids: string[], updates: OrderBulkUpdate, performedBy: string) {
  if (ids.length === 0) {
    return { updated: 0 };
  }

  const payload: OrderUpdate = {};
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.vendor_name !== undefined) payload.vendor_name = updates.vendor_name;
  if (updates.requested_by_name !== undefined) payload.requested_by_name = updates.requested_by_name || null;
  if (updates.requested_by_email !== undefined) payload.requested_by_email = updates.requested_by_email || null;
  if (updates.order_date !== undefined) payload.order_date = updates.order_date || null;
  if (updates.expected_delivery_date !== undefined) {
    payload.expected_delivery_date = updates.expected_delivery_date || null;
  }
  if (updates.received_date !== undefined) payload.received_date = updates.received_date || null;
  if (updates.notes !== undefined) payload.notes = updates.notes || null;

  if (Object.keys(payload).length === 0) {
    throw new Error("Select at least one field to update.");
  }

  const { data, error } = await supabase.from("orders").update(payload).in("id", ids).select("id,order_number,status");
  if (error) {
    if (error.code === "23505") throw new Error("An order with this order number already exists.");
    throw error;
  }

  const changedFields = Object.keys(payload);
  for (const order of data ?? []) {
    await logAudit(
      "ORDER",
      order.id,
      "BULK_UPDATED",
      {
        order_number: order.order_number,
        bulk: true,
        changed_fields: changedFields,
        updates: payload,
      },
      performedBy
    );
  }

  return { updated: data?.length ?? 0 };
}

export async function bulkDeleteOrders(ids: string[], performedBy: string): Promise<BulkMutationResult> {
  const result: BulkMutationResult = { succeeded: 0, failed: 0, errors: [] };

  for (const id of ids) {
    try {
      await deleteOrder(id, performedBy);
      result.succeeded += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
    }
  }

  if (result.succeeded === 0 && result.failed > 0) {
    throw new Error(result.errors[0] ?? "Failed to delete selected orders.");
  }

  return result;
}

export async function upsertOrderLineItems(
  orderId: string,
  lineItems: (OrderLineItemInsert & { asset_tag?: string | null })[],
  performedBy?: string
) {
  const { data: existingLineItems, error: existingLineItemsError } = await supabase
    .from("order_line_items")
    .select("id")
    .eq("order_id", orderId);
  if (existingLineItemsError) throw existingLineItemsError;

  const existingIds = new Set((existingLineItems ?? []).map((lineItem) => lineItem.id));
  const submittedIds = new Set(lineItems.map((lineItem) => lineItem.id).filter((lineItemId): lineItemId is string => !!lineItemId));
  const idsToDelete = [...existingIds].filter((lineItemId) => !submittedIds.has(lineItemId));

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("order_line_items")
      .delete()
      .eq("order_id", orderId)
      .in("id", idsToDelete);
    if (deleteError) throw deleteError;
  }

  const savedLineItems: OrderLineItem[] = [];
  const assetTagsByLineItemId: Record<string, string | null> = {};

  for (const lineItem of lineItems) {
    const { asset_tag: assetTag, id: lineItemId, ...lineItemPayload } = lineItem;

    if (lineItemId && existingIds.has(lineItemId)) {
      const { data: updatedLineItem, error: updateError } = await supabase
        .from("order_line_items")
        .update(lineItemPayload)
        .eq("id", lineItemId)
        .eq("order_id", orderId)
        .select("*")
        .single();
      if (updateError) throw updateError;
      savedLineItems.push(updatedLineItem);
      assetTagsByLineItemId[updatedLineItem.id] = assetTag ?? null;
      continue;
    }

    const { data: insertedLineItem, error: insertError } = await supabase
      .from("order_line_items")
      .insert({ ...lineItemPayload, id: createUuid(), order_id: orderId })
      .select("*")
      .single();
    if (insertError) throw insertError;
    savedLineItems.push(insertedLineItem);
    assetTagsByLineItemId[insertedLineItem.id] = assetTag ?? null;
  }

  if (performedBy) {
    await generateMissingAssetsForOrderLineItems(orderId, performedBy, assetTagsByLineItemId);
  }

  return savedLineItems;
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

  const { data: linkedAssets, error: assetLookupError } = await supabase
    .from("assets")
    .select(ASSET_SELECT)
    .eq("source_order_id", orderId)
    .eq("source_order_line_item_id", lineItem.id)
    .order("created_at", { ascending: true })
    .limit(100);
  if (assetLookupError) throw assetLookupError;

  if (!linkedAssets || linkedAssets.length === 0) {
    throw new Error("This line item is not linked to any asset. Fix the order line asset link before receiving.");
  }

  const existingConsumableAsset = linkedAssets.find((asset) => asset.is_consumable) ?? null;
  if (!existingConsumableAsset) {
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
    if (ledgerWriteError) throw ledgerWriteError;
    return;
  }

  let previousQuantityOnHand = 0;
  previousQuantityOnHand = normalizeQuantityOnHand(existingConsumableAsset.quantity_on_hand, 0);
  const { data: updatedAsset, error: updateAssetError } = await supabase
    .from("assets")
    .update({ quantity_on_hand: previousQuantityOnHand + delta })
    .eq("id", existingConsumableAsset.id)
    .select(ASSET_SELECT)
    .single();
  if (updateAssetError) throw updateAssetError;

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
    await supabase
      .from("assets")
      .update({ quantity_on_hand: previousQuantityOnHand })
      .eq("id", updatedAsset.id);
    throw ledgerWriteError;
  }

  await logAudit(
    "ASSET",
    updatedAsset.id,
    "QOH_INCREMENTED",
    {
      source_order_id: orderId,
      source_order_line_item_id: lineItem.id,
      line_item_name: lineItem.item_name,
      delta,
      previous_quantity_on_hand: previousQuantityOnHand,
      quantity_on_hand: updatedAsset.quantity_on_hand,
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
  const normalizedLineItemUpdates = lineItemUpdates.map((lineItemUpdate) => ({
    id: lineItemUpdate.id,
    received_quantity: normalizeReceivedQuantity(lineItemUpdate.received_quantity),
  }));

  const { data: linkedAssets, error: linkedAssetsError } = await supabase
    .from("assets")
    .select("source_order_line_item_id")
    .eq("source_order_id", orderId)
    .not("source_order_line_item_id", "is", null);
  if (linkedAssetsError) throw linkedAssetsError;

  const linkedLineItemIds = new Set(
    (linkedAssets ?? [])
      .map((asset) => asset.source_order_line_item_id)
      .filter((lineItemId): lineItemId is string => !!lineItemId)
  );

  const receivingWithoutLinks = normalizedLineItemUpdates
    .filter((lineItemUpdate) => lineItemUpdate.received_quantity > 0 && !linkedLineItemIds.has(lineItemUpdate.id))
    .map((lineItemUpdate) => lineItemUpdate.id);

  if (receivingWithoutLinks.length > 0) {
    const { data: missingLines, error: missingLinesError } = await supabase
      .from("order_line_items")
      .select("id,item_name")
      .eq("order_id", orderId)
      .in("id", receivingWithoutLinks);
    if (missingLinesError) throw missingLinesError;

    const missingNames = (missingLines ?? []).map((lineItem) => lineItem.item_name);
    throw new Error(
      `Cannot receive line item(s) without an asset link: ${missingNames.join(", ")}. Fix the order line asset link first.`
    );
  }

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

  for (const li of normalizedLineItemUpdates) {
    const desiredTotalReceived = li.received_quantity;

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

export async function generateAssetFromOrderLineItem(
  orderId: string,
  lineItemId: string,
  performedBy: string,
  assetTagInput?: string | null
) {
  const [{ data: order, error: orderError }, { data: lineItem, error: lineItemError }] = await Promise.all([
    supabase
      .from("orders")
      .select("order_number,order_date,shipping_tracking_number,vendor_name")
      .eq("id", orderId)
      .single(),
    supabase.from("order_line_items").select("*").eq("id", lineItemId).eq("order_id", orderId).single(),
  ]);

  if (orderError) throw orderError;
  if (lineItemError) throw lineItemError;
  if (!lineItem) throw new Error("Line item not found.");

  const { data: existingLinkedAsset, error: existingAssetError } = await supabase
    .from("assets")
    .select("id")
    .eq("source_order_id", orderId)
    .eq("source_order_line_item_id", lineItemId)
    .limit(1)
    .maybeSingle();
  if (existingAssetError) throw existingAssetError;

  if (existingLinkedAsset) {
    throw new Error("This order line item is already linked to an asset.");
  }

  const safeOrderedQuantity = Math.max(1, Math.trunc(lineItem.quantity || 1));
  const receivedQuantity = normalizeReceivedQuantity(lineItem.received_quantity);
  const category = inferAssetCategoryFromLineItemName(lineItem.item_name);
  const resolvedAssetTag = await ensureUniqueAssetTag(normalizeAssetTagInput(assetTagInput));

  const generatedNotes = [
    GENERATED_FROM_ORDER_MARKER,
    `Generated from order ${order.order_number}`,
    lineItem.notes ? `Description: ${lineItem.notes}` : null,
    `Ordered quantity: ${safeOrderedQuantity}`,
    lineItem.unit_cost != null ? `Unit cost: $${Number(lineItem.unit_cost).toFixed(2)}` : null,
    lineItem.sku ? `SKU: ${lineItem.sku}` : null,
    order.vendor_name ? `Vendor: ${order.vendor_name}` : null,
    order.shipping_tracking_number ? `Tracking: ${order.shipping_tracking_number}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const { data: generatedAsset, error: insertAssetError } = await supabase
    .from("assets")
    .insert({
      asset_tag: resolvedAssetTag,
      category,
      is_consumable: true,
      manufacturer: order.vendor_name || null,
      model: lineItem.item_name,
      notes: generatedNotes,
      purchase_date: order.order_date || null,
      quantity_on_hand: receivedQuantity,
      source_order_id: orderId,
      source_order_line_item_id: lineItemId,
      status: "IN_STOCK",
    })
    .select(ASSET_SELECT)
    .single();
  if (insertAssetError) throw insertAssetError;

  await logAudit(
    "ASSET",
    generatedAsset.id,
    "GENERATED_FROM_ORDER_LINE_ITEM",
    {
      order_id: orderId,
      order_number: order.order_number,
      order_line_item_id: lineItemId,
      item_name: lineItem.item_name,
      ordered_quantity: safeOrderedQuantity,
      received_quantity: receivedQuantity,
      asset_tag: generatedAsset.asset_tag,
    },
    performedBy
  );

  return generatedAsset;
}

export async function generateMissingAssetsForOrderLineItems(
  orderId: string,
  performedBy: string,
  assetTagsByLineItemId: Record<string, string | null | undefined> = {}
) {
  const [lineItems, linkedAssets] = await Promise.all([
    fetchOrderLineItems(orderId),
    fetchOrderLineItemAssetLinks(orderId),
  ]);

  const linkedLineItemIds = new Set(linkedAssets.map((asset) => asset.source_order_line_item_id));
  const generatedAssets: Asset[] = [];

  for (const lineItem of lineItems) {
    if (linkedLineItemIds.has(lineItem.id)) continue;
    const generatedAsset = await generateAssetFromOrderLineItem(
      orderId,
      lineItem.id,
      performedBy,
      assetTagsByLineItemId[lineItem.id] ?? null
    );
    generatedAssets.push(generatedAsset);
  }

  return generatedAssets;
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
