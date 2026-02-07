import { useQuery } from "@tanstack/react-query";
import { addDays, differenceInCalendarDays, format, isBefore, parseISO, startOfDay } from "date-fns";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadCsv, downloadXlsx } from "@/lib/export";

const ASSET_STATUS_ORDER = ["IN_STOCK", "ASSIGNED", "IN_REPAIR", "RETIRED"] as const;
const ORDER_STATUS_CLOSED = ["RECEIVED", "CANCELLED"] as const;
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to load report.";

const isBlank = (value?: string | null) => !value || value.trim().length === 0;

const formatDate = (value?: string | null) => (value ? format(parseISO(value), "MMM d, yyyy") : "—");

const ExportActions = ({
  filename,
  rows,
  sheetName,
}: {
  filename: string;
  rows: Record<string, unknown>[];
  sheetName?: string;
}) => (
  <div className="flex flex-wrap gap-2">
    <Button variant="outline" size="sm" onClick={() => downloadCsv(`${filename}.csv`, rows)}>
      Export CSV
    </Button>
    <Button variant="outline" size="sm" onClick={() => downloadXlsx(filename, rows, sheetName)}>
      Export Excel
    </Button>
  </div>
);

const ReportCardHeader = ({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions: React.ReactNode;
}) => (
  <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
    <div className="space-y-1.5">
      <CardTitle className="text-lg">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </div>
    {actions}
  </CardHeader>
);

export default function Reports() {
  const assetsByStatusQuery = useQuery({
    queryKey: ["reports", "assets-by-status"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assets").select("status");
      if (error) throw new Error(error.message);

      const counts = new Map<string, number>();
      (data ?? []).forEach((row) => {
        counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
      });

      const ordered = ASSET_STATUS_ORDER.map((status) => ({
        status,
        count: counts.get(status) ?? 0,
      }));

      const extras = Array.from(counts.entries())
        .filter(([status]) => !ASSET_STATUS_ORDER.includes(status as (typeof ASSET_STATUS_ORDER)[number]))
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([status, count]) => ({ status, count }));

      return [...ordered, ...extras];
    },
  });

  const assetsByCategoryQuery = useQuery({
    queryKey: ["reports", "assets-by-category"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assets").select("category");
      if (error) throw new Error(error.message);

      const counts = new Map<string, number>();
      (data ?? []).forEach((row) => {
        counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
      });

      return Array.from(counts.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);
    },
  });

  const assignmentSummaryQuery = useQuery({
    queryKey: ["reports", "assignment-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("status, assigned_to_email, assigned_to_name");
      if (error) throw new Error(error.message);

      const rows = data ?? [];
      const total = rows.length;
      const assigned = rows.filter((row) => row.assigned_to_email || row.assigned_to_name).length;
      const inStock = rows.filter((row) => row.status === "IN_STOCK").length;

      return { total, assigned, inStock };
    },
  });

  const warrantyExpiringQuery = useQuery({
    queryKey: ["reports", "warranty-expiring"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("asset_tag, category, warranty_end_date, assigned_to_name")
        .not("warranty_end_date", "is", null)
        .order("warranty_end_date", { ascending: true });
      if (error) throw new Error(error.message);

      const today = startOfDay(new Date());
      const limit = addDays(today, 90);

      const upcoming = (data ?? [])
        .map((row) => ({
          ...row,
          date: row.warranty_end_date ? parseISO(row.warranty_end_date) : null,
        }))
        .filter((row) => row.date && row.date >= today && row.date <= limit)
        .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));

      const counts = { within30: 0, within60: 0, within90: 0 };
      upcoming.forEach((row) => {
        if (!row.date) return;
        const diff = differenceInCalendarDays(row.date, today);
        if (diff <= 30) counts.within30 += 1;
        if (diff <= 60) counts.within60 += 1;
        if (diff <= 90) counts.within90 += 1;
      });

      return { counts, items: upcoming.slice(0, 10) };
    },
  });

  const assetsMissingSerialQuery = useQuery({
    queryKey: ["reports", "assets-missing-serial"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("asset_tag, category, manufacturer, model, assigned_to_name, serial_number");
      if (error) throw new Error(error.message);

      const missing = (data ?? []).filter((row) => isBlank(row.serial_number));
      return { count: missing.length, items: missing.slice(0, 15) };
    },
  });

  const assetsMissingLocationQuery = useQuery({
    queryKey: ["reports", "assets-missing-location"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("asset_tag, category, status, assigned_to_name, location");
      if (error) throw new Error(error.message);

      const missing = (data ?? []).filter((row) => isBlank(row.location));
      return { count: missing.length, items: missing.slice(0, 15) };
    },
  });

  const ordersByStatusQuery = useQuery({
    queryKey: ["reports", "orders-by-status"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("status");
      if (error) throw new Error(error.message);

      const counts = new Map<string, number>();
      (data ?? []).forEach((row) => {
        counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
      });

      return Array.from(counts.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);
    },
  });

  const overdueOrdersQuery = useQuery({
    queryKey: ["reports", "overdue-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("order_number, vendor_name, status, expected_delivery_date")
        .not("expected_delivery_date", "is", null);
      if (error) throw new Error(error.message);

      const today = startOfDay(new Date());
      const overdue = (data ?? [])
        .filter((row) =>
          row.expected_delivery_date
            ? isBefore(parseISO(row.expected_delivery_date), today) &&
              !ORDER_STATUS_CLOSED.includes(row.status as (typeof ORDER_STATUS_CLOSED)[number])
            : false
        )
        .sort(
          (a, b) =>
            parseISO(a.expected_delivery_date as string).getTime() -
            parseISO(b.expected_delivery_date as string).getTime()
        );

      return overdue.slice(0, 10);
    },
  });

  const ordersMissingAssetsQuery = useQuery({
    queryKey: ["reports", "orders-missing-assets"],
    queryFn: async () => {
      const [{ data: orders, error: ordersError }, { data: assets, error: assetsError }] =
        await Promise.all([
          supabase.from("orders").select("id, order_number, vendor_name, received_date, status").eq("status", "RECEIVED"),
          supabase.from("assets").select("source_order_id").not("source_order_id", "is", null),
        ]);

      if (ordersError) throw new Error(ordersError.message);
      if (assetsError) throw new Error(assetsError.message);

      const orderIdsWithAssets = new Set(
        (assets ?? []).map((asset) => asset.source_order_id).filter((value): value is string => !!value)
      );

      const missing = (orders ?? []).filter((order) => !orderIdsWithAssets.has(order.id));
      return missing.slice(0, 15);
    },
  });

  const spendByVendorQuery = useQuery({
    queryKey: ["reports", "spend-by-vendor"],
    queryFn: async () => {
      const [{ data: orders, error: ordersError }, { data: items, error: itemsError }] =
        await Promise.all([
          supabase.from("orders").select("id, vendor_name"),
          supabase.from("order_line_items").select("order_id, quantity, unit_cost"),
        ]);

      if (ordersError) throw new Error(ordersError.message);
      if (itemsError) throw new Error(itemsError.message);

      const vendorByOrder = new Map<string, string>();
      (orders ?? []).forEach((order) => {
        vendorByOrder.set(order.id, order.vendor_name || "Unknown");
      });

      const spendByVendor = new Map<string, number>();
      (items ?? []).forEach((item) => {
        const vendor = vendorByOrder.get(item.order_id) ?? "Unknown";
        const unitCost = item.unit_cost ?? 0;
        const quantity = item.quantity ?? 0;
        const total = unitCost * quantity;
        spendByVendor.set(vendor, (spendByVendor.get(vendor) ?? 0) + total);
      });

      return Array.from(spendByVendor.entries())
        .map(([vendor, spend]) => ({ vendor, spend }))
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 10);
    },
  });

  const recentActivityQuery = useQuery({
    queryKey: ["reports", "recent-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("timestamp, entity_type, action, performed_by")
        .order("timestamp", { ascending: false })
        .limit(15);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const assetsByStatusRows =
    assetsByStatusQuery.data?.map((row) => ({
      status: row.status.replace(/_/g, " "),
      count: row.count,
    })) ?? [];

  const assetsByCategoryRows =
    assetsByCategoryQuery.data?.map((row) => ({
      category: row.category,
      count: row.count,
    })) ?? [];

  const assignmentSummaryRows = assignmentSummaryQuery.data
    ? [
        { metric: "Total assets", value: assignmentSummaryQuery.data.total },
        { metric: "Assigned", value: assignmentSummaryQuery.data.assigned },
        { metric: "In stock", value: assignmentSummaryQuery.data.inStock },
      ]
    : [];

  const warrantyRows =
    warrantyExpiringQuery.data?.items?.map((asset) => ({
      asset_tag: asset.asset_tag,
      category: asset.category,
      warranty_end_date: formatDate(asset.warranty_end_date),
      assigned_to_name: asset.assigned_to_name || "—",
    })) ?? [];

  const assetsMissingSerialRows =
    assetsMissingSerialQuery.data?.items?.map((asset) => ({
      asset_tag: asset.asset_tag,
      category: asset.category,
      manufacturer: asset.manufacturer || "—",
      model: asset.model || "—",
      assigned_to_name: asset.assigned_to_name || "—",
    })) ?? [];

  const assetsMissingLocationRows =
    assetsMissingLocationQuery.data?.items?.map((asset) => ({
      asset_tag: asset.asset_tag,
      category: asset.category,
      status: asset.status.replace(/_/g, " "),
      assigned_to_name: asset.assigned_to_name || "—",
    })) ?? [];

  const ordersByStatusRows =
    ordersByStatusQuery.data?.map((row) => ({
      status: row.status.replace(/_/g, " "),
      count: row.count,
    })) ?? [];

  const ordersMissingAssetsRows =
    ordersMissingAssetsQuery.data?.map((order) => ({
      order_number: order.order_number,
      vendor_name: order.vendor_name,
      received_date: formatDate(order.received_date),
      action: "Create Assets",
    })) ?? [];

  const overdueOrdersRows =
    overdueOrdersQuery.data?.map((order) => ({
      order_number: order.order_number,
      vendor_name: order.vendor_name,
      status: order.status.replace(/_/g, " "),
      expected_delivery_date: formatDate(order.expected_delivery_date),
    })) ?? [];

  const spendByVendorRows =
    spendByVendorQuery.data?.map((row) => ({
      vendor: row.vendor,
      spend: currency.format(row.spend),
    })) ?? [];

  const recentActivityRows =
    recentActivityQuery.data?.map((entry) => ({
      timestamp: format(new Date(entry.timestamp), "MMM d, yyyy HH:mm"),
      entity_type: entry.entity_type,
      action: entry.action,
      performed_by: entry.performed_by,
    })) ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">Quick insights across assets and orders.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <ReportCardHeader
            title="Assets by Status"
            description="Inventory distribution across lifecycle states."
            actions={<ExportActions filename="assets-by-status" rows={assetsByStatusRows} sheetName="Assets by Status" />}
          />
          <CardContent>
            {assetsByStatusQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : assetsByStatusQuery.error ? (
              <p className="text-sm text-destructive">{errorMessage(assetsByStatusQuery.error)}</p>
            ) : assetsByStatusQuery.data?.length ? (
              <ul className="space-y-2 text-sm">
                {assetsByStatusQuery.data.map((row) => (
                  <li key={row.status} className="flex items-center justify-between">
                    <Link
                      to={`/assets?status=${row.status}`}
                      className="text-muted-foreground hover:underline"
                    >
                      {row.status.replace(/_/g, " ")}
                    </Link>
                    <span className="font-medium text-foreground">{row.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No assets found.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <ReportCardHeader
            title="Assets by Category"
            description="Top categories by asset count."
            actions={<ExportActions filename="assets-by-category" rows={assetsByCategoryRows} sheetName="Assets by Category" />}
          />
          <CardContent>
            {assetsByCategoryQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : assetsByCategoryQuery.error ? (
              <p className="text-sm text-destructive">{errorMessage(assetsByCategoryQuery.error)}</p>
            ) : assetsByCategoryQuery.data?.length ? (
              <ul className="space-y-2 text-sm">
                {assetsByCategoryQuery.data.map((row) => (
                  <li key={row.category} className="flex items-center justify-between">
                    <Link
                      to={`/assets?category=${encodeURIComponent(row.category)}`}
                      className="text-muted-foreground capitalize hover:underline"
                    >
                      {row.category}
                    </Link>
                    <span className="font-medium text-foreground">{row.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No assets found.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <ReportCardHeader
            title="Assignment Summary"
            description="Assigned vs in-stock overview."
            actions={<ExportActions filename="assignment-summary" rows={assignmentSummaryRows} sheetName="Assignment Summary" />}
          />
          <CardContent>
            {assignmentSummaryQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : assignmentSummaryQuery.error ? (
              <p className="text-sm text-destructive">{errorMessage(assignmentSummaryQuery.error)}</p>
            ) : assignmentSummaryQuery.data ? (
              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total assets</span>
                  <span className="font-medium text-foreground">{assignmentSummaryQuery.data.total}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-muted-foreground">Assigned</span>
                  <span className="font-medium text-foreground">{assignmentSummaryQuery.data.assigned}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-muted-foreground">In stock</span>
                  <span className="font-medium text-foreground">{assignmentSummaryQuery.data.inStock}</span>
                </li>
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No assets found.</p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2 xl:col-span-2">
          <ReportCardHeader
            title="Warranty Expiring"
            description="Assets with warranties ending soon."
            actions={<ExportActions filename="warranty-expiring" rows={warrantyRows} sheetName="Warranty Expiring" />}
          />
          <CardContent>
            {warrantyExpiringQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : warrantyExpiringQuery.error ? (
              <p className="text-sm text-destructive">{errorMessage(warrantyExpiringQuery.error)}</p>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-md border bg-background px-3 py-2">
                    <p className="text-xs text-muted-foreground">Next 30 days</p>
                    <p className="text-lg font-semibold text-foreground">
                      {warrantyExpiringQuery.data?.counts.within30 ?? 0}
                    </p>
                  </div>
                  <div className="rounded-md border bg-background px-3 py-2">
                    <p className="text-xs text-muted-foreground">Next 60 days</p>
                    <p className="text-lg font-semibold text-foreground">
                      {warrantyExpiringQuery.data?.counts.within60 ?? 0}
                    </p>
                  </div>
                  <div className="rounded-md border bg-background px-3 py-2">
                    <p className="text-xs text-muted-foreground">Next 90 days</p>
                    <p className="text-lg font-semibold text-foreground">
                      {warrantyExpiringQuery.data?.counts.within90 ?? 0}
                    </p>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset Tag</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Warranty End</TableHead>
                      <TableHead>Assigned To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warrantyExpiringQuery.data?.items?.length ? (
                      warrantyExpiringQuery.data.items.map((asset) => (
                        <TableRow key={asset.asset_tag}>
                          <TableCell className="font-medium">{asset.asset_tag}</TableCell>
                          <TableCell className="capitalize">{asset.category}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(asset.warranty_end_date)}
                          </TableCell>
                          <TableCell>{asset.assigned_to_name || "—"}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                          No expiring warranties in the next 90 days.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <ReportCardHeader
            title="Assets Missing Serial Number"
            description="Assets without a recorded serial number."
            actions={<ExportActions filename="assets-missing-serial" rows={assetsMissingSerialRows} sheetName="Missing Serial Numbers" />}
          />
          <CardContent>
            {assetsMissingSerialQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : assetsMissingSerialQuery.error ? (
              <p className="text-sm text-destructive">{errorMessage(assetsMissingSerialQuery.error)}</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Count:{" "}
                  <span className="font-medium text-foreground">
                    {assetsMissingSerialQuery.data?.count ?? 0}
                  </span>
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset Tag</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Manufacturer</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Assigned To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assetsMissingSerialQuery.data?.items?.length ? (
                      assetsMissingSerialQuery.data.items.map((asset) => (
                        <TableRow key={asset.asset_tag}>
                          <TableCell className="font-medium">{asset.asset_tag}</TableCell>
                          <TableCell className="capitalize">{asset.category}</TableCell>
                          <TableCell>{asset.manufacturer || "—"}</TableCell>
                          <TableCell>{asset.model || "—"}</TableCell>
                          <TableCell>{asset.assigned_to_name || "—"}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                          No assets missing serial numbers.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <ReportCardHeader
            title="Assets Missing Location"
            description="Assets without a recorded location."
            actions={<ExportActions filename="assets-missing-location" rows={assetsMissingLocationRows} sheetName="Missing Locations" />}
          />
          <CardContent>
            {assetsMissingLocationQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : assetsMissingLocationQuery.error ? (
              <p className="text-sm text-destructive">{errorMessage(assetsMissingLocationQuery.error)}</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Count:{" "}
                  <span className="font-medium text-foreground">
                    {assetsMissingLocationQuery.data?.count ?? 0}
                  </span>
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset Tag</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assetsMissingLocationQuery.data?.items?.length ? (
                      assetsMissingLocationQuery.data.items.map((asset) => (
                        <TableRow key={asset.asset_tag}>
                          <TableCell className="font-medium">{asset.asset_tag}</TableCell>
                          <TableCell className="capitalize">{asset.category}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {asset.status.replace(/_/g, " ")}
                          </TableCell>
                          <TableCell>{asset.assigned_to_name || "—"}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                          No assets missing locations.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <ReportCardHeader
            title="Orders by Status"
            description="Order pipeline snapshot."
            actions={<ExportActions filename="orders-by-status" rows={ordersByStatusRows} sheetName="Orders by Status" />}
          />
          <CardContent>
            {ordersByStatusQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : ordersByStatusQuery.error ? (
              <p className="text-sm text-destructive">{errorMessage(ordersByStatusQuery.error)}</p>
            ) : ordersByStatusQuery.data?.length ? (
              <ul className="space-y-2 text-sm">
                {ordersByStatusQuery.data.map((row) => (
                  <li key={row.status} className="flex items-center justify-between">
                    <Link
                      to={`/orders?status=${row.status}`}
                      className="text-muted-foreground hover:underline"
                    >
                      {row.status.replace(/_/g, " ")}
                    </Link>
                    <span className="font-medium text-foreground">{row.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No orders found.</p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <ReportCardHeader
            title="Orders Received Without Assets"
            description="Received orders with no linked assets."
            actions={<ExportActions filename="orders-missing-assets" rows={ordersMissingAssetsRows} sheetName="Orders Missing Assets" />}
          />
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersMissingAssetsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : ordersMissingAssetsQuery.error ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-destructive">
                      {errorMessage(ordersMissingAssetsQuery.error)}
                    </TableCell>
                  </TableRow>
                ) : ordersMissingAssetsQuery.data?.length ? (
                  ordersMissingAssetsQuery.data.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{order.vendor_name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(order.received_date)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={`/orders/${order.id}`} className="text-sm text-primary hover:underline">
                          Create Assets
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      All received orders have assets.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <ReportCardHeader
            title="Overdue Orders"
            description="Orders past expected delivery date."
            actions={<ExportActions filename="overdue-orders" rows={overdueOrdersRows} sheetName="Overdue Orders" />}
          />
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expected Delivery</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueOrdersQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : overdueOrdersQuery.error ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-destructive">
                      {errorMessage(overdueOrdersQuery.error)}
                    </TableCell>
                  </TableRow>
                ) : overdueOrdersQuery.data?.length ? (
                  overdueOrdersQuery.data.map((order) => (
                    <TableRow key={order.order_number}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{order.vendor_name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {order.status.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(order.expected_delivery_date)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      No overdue orders.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <ReportCardHeader
            title="Spend by Vendor"
            description="Approximate spend based on line items."
            actions={<ExportActions filename="spend-by-vendor" rows={spendByVendorRows} sheetName="Spend by Vendor" />}
          />
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spendByVendorQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="py-6 text-center text-sm text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : spendByVendorQuery.error ? (
                  <TableRow>
                    <TableCell colSpan={2} className="py-6 text-center text-sm text-destructive">
                      {errorMessage(spendByVendorQuery.error)}
                    </TableCell>
                  </TableRow>
                ) : spendByVendorQuery.data?.length ? (
                  spendByVendorQuery.data.map((row) => (
                    <TableRow key={row.vendor}>
                      <TableCell>
                        <Link
                          to={`/orders?vendor=${encodeURIComponent(row.vendor)}`}
                          className="hover:underline text-muted-foreground"
                        >
                          {row.vendor}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {currency.format(row.spend)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="py-6 text-center text-sm text-muted-foreground">
                      No spend data available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 xl:col-span-3">
          <ReportCardHeader
            title="Recent Activity"
            description="Latest audit log entries."
            actions={<ExportActions filename="recent-activity" rows={recentActivityRows} sheetName="Recent Activity" />}
          />
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Performed By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivityQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : recentActivityQuery.error ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-destructive">
                      {errorMessage(recentActivityQuery.error)}
                    </TableCell>
                  </TableRow>
                ) : recentActivityQuery.data?.length ? (
                  recentActivityQuery.data.map((entry, index) => (
                    <TableRow key={`${entry.timestamp}-${index}`}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {format(new Date(entry.timestamp), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>{entry.entity_type}</TableCell>
                      <TableCell className="font-medium">{entry.action}</TableCell>
                      <TableCell>{entry.performed_by}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      No recent activity.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
