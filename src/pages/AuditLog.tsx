import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchAuditLog } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { Link } from "react-router-dom";

type AuditEntry = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  details: unknown;
  performed_by: string;
  timestamp: string;
};

export default function AuditLog() {
  const [entityType, setEntityType] = useState<string>("");

  const { data: entries, isLoading } = useQuery({
    queryKey: ["audit-log", entityType],
    queryFn: () => fetchAuditLog({ entityType: entityType || undefined }),
  });

  const assetIds = useMemo(() => {
    const ids = new Set<string>();
    entries?.forEach((entry: AuditEntry) => {
      if (entry.entity_type === "ASSET" && entry.entity_id) {
        ids.add(entry.entity_id);
      }
    });
    return Array.from(ids);
  }, [entries]);

  const orderIds = useMemo(() => {
    const ids = new Set<string>();
    entries?.forEach((entry: AuditEntry) => {
      if (entry.entity_type === "ORDER" && entry.entity_id) {
        ids.add(entry.entity_id);
      }
    });
    return Array.from(ids);
  }, [entries]);

  const { data: assetRows } = useQuery({
    queryKey: ["audit-assets", assetIds],
    enabled: assetIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id, asset_tag")
        .in("id", assetIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: orderRows } = useQuery({
    queryKey: ["audit-orders", orderIds],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number")
        .in("id", orderIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const assetMap = useMemo(
    () => new Map(assetRows?.map((row) => [row.id, row.asset_tag]) ?? []),
    [assetRows]
  );
  const orderMap = useMemo(
    () => new Map(orderRows?.map((row) => [row.id, row.order_number]) ?? []),
    [orderRows]
  );

  const isEmpty = !isLoading && (entries?.length ?? 0) === 0;

  const actionPhrase = (action: string) => {
    const map: Record<string, string> = {
      INSERT: "created",
      UPDATE: "updated",
      DELETE: "deleted",
      CREATED: "created",
      UPDATED: "updated",
      DELETED: "deleted",
      STATUS_CHANGED: "updated",
      RECEIVED: "received",
    };
    return map[action] ?? action.toLowerCase().replace(/_/g, " ");
  };

  const formatStatusLabel = (value: string) => {
    const assetMapLabel: Record<string, string> = {
      IN_STOCK: "Available",
      ASSIGNED: "Assigned",
      IN_REPAIR: "In repair",
      RETIRED: "Retired",
    };
    const orderMapLabel: Record<string, string> = {
      REQUESTED: "Requested",
      APPROVED: "Approved",
      ORDERED: "Ordered",
      SHIPPED: "Shipped",
      RECEIVED: "Received",
      CANCELLED: "Cancelled",
    };
    return assetMapLabel[value] ?? orderMapLabel[value] ?? value;
  };

  const getDetailsObject = (details: unknown) =>
    details && typeof details === "object" ? (details as Record<string, unknown>) : null;

  const getEntityName = (entry: AuditEntry) => {
    const details = getDetailsObject(entry.details);
    const before =
      details?.before && typeof details.before === "object"
        ? (details.before as Record<string, unknown>)
        : null;
    const after =
      details?.after && typeof details.after === "object"
        ? (details.after as Record<string, unknown>)
        : null;

    const fromDetails =
      (typeof details?.asset_tag === "string" && details.asset_tag) ||
      (typeof details?.order_number === "string" && details.order_number) ||
      (typeof after?.asset_tag === "string" && after.asset_tag) ||
      (typeof after?.order_number === "string" && after.order_number) ||
      (typeof before?.asset_tag === "string" && before.asset_tag) ||
      (typeof before?.order_number === "string" && before.order_number);

    if (fromDetails) return fromDetails;
    if (entry.entity_type === "ASSET") return assetMap.get(entry.entity_id) || entry.entity_id.slice(0, 8);
    return orderMap.get(entry.entity_id) || entry.entity_id.slice(0, 8);
  };

  const getChanges = (entry: AuditEntry) => {
    const updateActions = new Set(["UPDATE", "UPDATED", "STATUS_CHANGED"]);
    if (!updateActions.has(entry.action)) return [];
    const details = getDetailsObject(entry.details);
    if (!details?.before || !details?.after) return [];
    const before =
      typeof details.before === "object" ? (details.before as Record<string, unknown>) : null;
    const after =
      typeof details.after === "object" ? (details.after as Record<string, unknown>) : null;
    if (!before || !after) return [];

    const changedKeys = Object.keys(after).filter((key) => before[key] !== after[key]);
    const preferred = ["status", "assigned_to_name", "location", "vendor_name", "order_number"];
    const ordered = [
      ...preferred.filter((key) => changedKeys.includes(key)),
      ...changedKeys.filter((key) => !preferred.includes(key)),
    ].slice(0, 3);

    return ordered.map((key) => {
      const beforeValue = before[key];
      const afterValue = after[key];
      const formatValue = (value: unknown) => {
        if (value === null || value === undefined || value === "") return "—";
        if (key === "status" && typeof value === "string") return formatStatusLabel(value);
        return String(value);
      };
      return `${key}: ${formatValue(beforeValue)} → ${formatValue(afterValue)}`;
    });
  };

  return (
    <div>
      <PageHeader title="Audit Log">
        <Select value={entityType} onValueChange={(v) => setEntityType(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="ASSET">Asset</SelectItem>
            <SelectItem value="ORDER">Order</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      {isEmpty ? (
        <Card>
          <CardHeader>
            <CardTitle>No activity yet</CardTitle>
            <CardDescription>Create assets or orders to start building your audit trail.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/assets/new">Add Asset</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {isLoading ? (
            <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
              Loading...
            </div>
          ) : (
            entries?.map((entry: AuditEntry) => {
              const entityLabel = entry.entity_type === "ASSET" ? "Asset" : "Order";
              const name = getEntityName(entry);
              const phrase = actionPhrase(entry.action);
              const changes = getChanges(entry);
              return (
                <div key={entry.id} className="rounded-lg border bg-card p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-foreground">
                        {entityLabel} {name} {phrase} by{" "}
                        <span className="text-muted-foreground">{entry.performed_by}</span>
                      </p>
                      {changes.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Changes: {changes.join(", ")}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(entry.timestamp), "MMM d, yyyy HH:mm")}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
