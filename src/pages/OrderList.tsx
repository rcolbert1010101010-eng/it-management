import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Plus, Search } from "lucide-react";
import { fetchOrders, ORDER_STATUSES } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { getOrderStatusLabel } from "@/lib/status";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
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
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [vendor, setVendor] = useState("");
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
                {orderSortableColumns.map((column) => renderSortHeader(column.key, column.label))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : (
                sortedOrders.map((order) => (
                  <TableRow key={order.id}>
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
    </div>
  );
}
