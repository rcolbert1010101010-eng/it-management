import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { fetchOrders, ORDER_STATUSES } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
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

export default function OrderList() {
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [vendor, setVendor] = useState("");

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
      if (!vendor) return data;
      return data.filter((order) => order.vendor_name === vendor);
    },
  });
  const isEmpty = !isLoading && (orders?.length ?? 0) === 0;

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
                {s}
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
                <TableHead>Order #</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Expected Delivery</TableHead>
                <TableHead>Requested By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : (
                orders?.map((order) => (
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
