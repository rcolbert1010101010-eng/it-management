import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

export type Asset = Database["public"]["Tables"]["assets"]["Row"];
export type AssetInsert = Database["public"]["Tables"]["assets"]["Insert"];
export type AssetUpdate = Database["public"]["Tables"]["assets"]["Update"];
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

// ---- Assets ----

export async function fetchAssets(params?: {
  search?: string;
  status?: string;
  category?: string;
}) {
  let query = supabase.from("assets").select("*").order("created_at", { ascending: false });

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
  const { data, error } = await supabase.from("assets").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createAsset(asset: AssetInsert, performedBy: string) {
  const { data, error } = await supabase.from("assets").insert(asset).select().single();
  if (error) {
    if (error.code === "23505") {
      throw new Error("An asset with this asset tag already exists.");
    }
    throw error;
  }
  await logAudit("ASSET", data.id, "CREATED", { asset_tag: data.asset_tag }, performedBy);
  return data;
}

export async function updateAsset(id: string, updates: AssetUpdate, performedBy: string) {
  const { data: old } = await supabase.from("assets").select("status").eq("id", id).single();
  const { data, error } = await supabase.from("assets").update(updates).eq("id", id).select().single();
  if (error) {
    if (error.code === "23505") {
      throw new Error("An asset with this asset tag already exists.");
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

export async function markOrderReceived(
  orderId: string,
  lineItemUpdates: { id: string; received_quantity: number }[],
  performedBy: string
) {
  const { error: orderError } = await supabase
    .from("orders")
    .update({ status: "RECEIVED", received_date: new Date().toISOString().split("T")[0] })
    .eq("id", orderId);
  if (orderError) throw orderError;

  for (const li of lineItemUpdates) {
    await supabase.from("order_line_items").update({ received_quantity: li.received_quantity }).eq("id", li.id);
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
    source_order_id: orderId,
    source_order_line_item_id: lineItemId,
    status: "IN_STOCK",
  }));

  const { data, error } = await supabase.from("assets").insert(assets).select();
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
