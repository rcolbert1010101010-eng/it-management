import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import {
  bulkDeleteOrders,
  bulkUpdateOrders,
  fetchOrders,
  ORDER_STATUSES,
  type OrderBulkUpdate,
} from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { getOrderStatusLabel } from "@/lib/status";
import { useAppStore } from "@/lib/store";
import { BulkActionBar } from "@/components/BulkActionBar";
import { BulkEditOrdersDialog } from "@/components/BulkEditOrdersDialog";
import { ConfirmBulkDeleteDialog } from "@/components/ConfirmBulkDeleteDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

const decodeParam = (value: string | null) => {
  if (value === null) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

type SortDirection = "asc" | "desc";
type OrderSortKey =
  | "order_number"
  | "vendor_name"
  | "line_items_summary"
  | "status"
  | "order_date"
  | "expected_delivery_date"
  | "requested_by_name";

type OrderSortConfig = {
  key: OrderSortKey;
  direction: SortDirection;
};

const orderSortableColumns: { key: OrderSortKey; label: string }[] = [
  { key: "order_number", label: "Order #" },
  { key: "vendor_name", label: "Vendor" },
  { key: "line_items_summary", label: "Items" },
  { key: "status", label: "Status" },
  { key: "order_date", label: "Order Date" },
  { key: "expected_delivery_date", label: "Expected Delivery" },
  { key: "requested_by_name", label: "Requested For" },
];

const compareText = (a: string | null | undefined, b: string | null | undefined) =>
  (a || "").localeCompare(b || "", undefined, { sensitivity: "base", numeric: true });

const compareDate = (a: string | null | undefined, b: string | null | undefined) => {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
};

export default function OrderList() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const performedBy = useAppStore((s) => s.performedBy);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [vendor, setVendor] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<OrderSortConfig>({
    key: "order_number",
    direction: "asc",
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = decodeParam(params.get("status"));
    const vendorParam = decodeParam(params.get("vendor"));
    const searchParam = decodeParam(params.get("q"));

    if (statusParam !== null) setStatus(statusParam);
    if (vendorParam !== null) setVendor(vendorParam);
    if (searchParam !== null) setSearch(searchParam);
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (status) params.set("status", status);
    if (vendor) params.set("vendor", vendor);

    const next = params.toString();
    const current = location.search.startsWith("?") ? location.search.slice(1) : location.search;
    if (next !== current) {
      navigate(next ? `?${next}` : "", { replace: true });
    }
  }, [search, status, vendor, navigate, location.search]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", search, status, vendor],
    queryFn: async () => {
      const data = await fetchOrders({
        search: search || undefined,
        status: status || undefined,
      });
      const filtered = vendor ? data.filter((order) => order.vendor_name === vendor) : data;

      // Fetch line items for all orders
      const orderIds = filtered.map((o) => o.id);
      if (orderIds.length === 0) return filtered.map((o) => ({ ...o, line_items_summary: "" }));

      const { data: lineItems } = await supabase
        .from("order_line_items")
        .select("order_id, item_name, quantity")
        .in("order_id", orderIds);

      const itemsByOrder = (lineItems || []).reduce<Record<string, string[]>>((acc, li) => {
        if (!acc[li.order_id]) acc[li.order_id] = [];
        acc[li.order_id].push(li.quantity > 1 ? `${li.item_name} (×${li.quantity})` : li.item_name);
        return acc;
      }, {});

      return filtered.map((o) => ({
        ...o,
        line_items_summary: itemsByOrder[o.id]?.join(", ") || "",
      }));
    },
  });

  const sortedOrders = useMemo(() => {
    const sorted = [...(orders ?? [])];
    sorted.sort((a, b) => {
      let result = 0;
      if (sortConfig.key === "order_date" || sortConfig.key === "expected_delivery_date") {
        result = compareDate(a[sortConfig.key], b[sortConfig.key]);
      } else {
        result = compareText(a[sortConfig.key], b[sortConfig.key]);
      }
      return sortConfig.direction === "asc" ? result : -result;
    });
    return sorted;
  }, [orders, sortConfig]);

  const requestSort = (key: OrderSortKey) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const renderSortHeader = (key: OrderSortKey, label: string) => (
    <TableHead key={key}>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-left font-medium transition-colors hover:text-foreground"
        onClick={() => requestSort(key)}
      >
        {label}
        {sortConfig.key === key && (
          sortConfig.direction === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
        )}
      </button>
    </TableHead>
  );

  const visibleIds = useMemo(() => sortedOrders.map((order) => order.id), [sortedOrders]);
  const selectedCount = selectedIds.size;
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected = visibleIds.some((id) => selectedIds.has(id)) && !allSelected;

  const clearSelection = () => setSelectedIds(new Set());

  const toggleRowSelection = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(visibleIds));
    } else {
      clearSelection();
    }
  };

  const bulkUpdateMutation = useMutation({
    mutationFn: (updates: OrderBulkUpdate) => {
      if (updates.vendor_name !== undefined && !updates.vendor_name.trim()) {
        throw new Error("Vendor name cannot be empty.");
      }
      return bulkUpdateOrders([...selectedIds], updates, performedBy);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setBulkEditOpen(false);
      clearSelection();
      toast.success(`Updated ${result.updated} order${result.updated === 1 ? "" : "s"}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: () => bulkDeleteOrders([...selectedIds], performedBy),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setBulkDeleteOpen(false);
      clearSelection();
      if (result.failed > 0) {
        toast.warning(`Deleted ${result.succeeded}, failed ${result.failed}`);
      } else {
        toast.success(`Deleted ${result.succeeded} order${result.succeeded === 1 ? "" : "s"}`);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const isBulkPending = bulkUpdateMutation.isPending || bulkDeleteMutation.isPending;
  const isEmpty = !isLoading && sortedOrders.length === 0;

  return (
    <div>
      <PageHeader title="Orders">
        <Button asChild>
          <Link to="/orders/new">
            <Plus className="mr-1.5 h-4 w-4" />
            New Order
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by order number, vendor..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {getOrderStatusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <BulkActionBar
        entityLabel="order"
        selectedCount={selectedCount}
        onBulkEdit={() => setBulkEditOpen(true)}
        onDelete={() => setBulkDeleteOpen(true)}
        onClear={clearSelection}
        isPending={isBulkPending}
      />

      {isEmpty ? (
        <Card>
          <CardHeader>
            <CardTitle>No orders yet</CardTitle>
            <CardDescription>
              Create your first order to track purchases and deliveries.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/orders/new">New Order</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                    aria-label="Select all orders"
                  />
                </TableHead>
                {orderSortableColumns.map((column) => renderSortHeader(column.key, column.label))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : (
                sortedOrders.map((order) => (
                  <TableRow key={order.id} data-state={selectedIds.has(order.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(order.id)}
                        onCheckedChange={(checked) => toggleRowSelection(order.id, checked === true)}
                        aria-label={`Select order ${order.order_number}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/orders/${order.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {order.order_number}
                      </Link>
                    </TableCell>
                    <TableCell>{order.vendor_name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[250px] truncate">
                      {order.line_items_summary || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="order" value={order.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {order.order_date ? format(new Date(order.order_date), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {order.expected_delivery_date
                        ? format(new Date(order.expected_delivery_date), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>{order.requested_by_name || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <BulkEditOrdersDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        selectedCount={selectedCount}
        onSubmit={(updates) => bulkUpdateMutation.mutate(updates)}
        isPending={bulkUpdateMutation.isPending}
      />
      <ConfirmBulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        entityLabel="order"
        count={selectedCount}
        onConfirm={() => bulkDeleteMutation.mutate()}
        isPending={bulkDeleteMutation.isPending}
      />
    </div>
  );
}
