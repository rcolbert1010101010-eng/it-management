import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Plus, Search } from "lucide-react";
import { fetchAssets, ASSET_STATUSES, ASSET_CATEGORIES } from "@/lib/api";
import {
  daysSinceLastLogin,
  daysUntilNetworkRemoval,
  getNetworkComplianceState,
  type NetworkComplianceState,
} from "@/lib/assetLifecycle";
import { useTodayDate } from "@/lib/dateNow";
import { AssetLifecycleBadge } from "@/components/AssetLifecycleBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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

const formatDateValue = (value: string | null) =>
  value ? format(parseISO(value), "MMM d, yyyy") : "Unknown";

const complianceCellColors: Record<NetworkComplianceState, string> = {
  healthy: "text-emerald-700 dark:text-emerald-400",
  warning: "text-amber-700 dark:text-amber-400",
  overdue: "text-red-700 dark:text-red-400",
  unknown: "text-slate-600 dark:text-slate-400",
};

const decodeParam = (value: string | null) => {
  if (value === null) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export default function AssetList() {
  const location = useLocation();
  const navigate = useNavigate();
  const today = useTodayDate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [complianceFilter, setComplianceFilter] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = decodeParam(params.get("status"));
    const categoryParam = decodeParam(params.get("category"));
    const searchParam = decodeParam(params.get("q"));
    const complianceParam = decodeParam(params.get("compliance"));

    setStatus(statusParam ?? "");
    setCategory(categoryParam ?? "");
    setSearch(searchParam ?? "");
    setComplianceFilter(complianceParam ?? "");
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    if (complianceFilter) params.set("compliance", complianceFilter);

    const next = params.toString();
    const current = location.search.startsWith("?") ? location.search.slice(1) : location.search;
    if (next !== current) {
      navigate(next ? `?${next}` : "", { replace: true });
    }
  }, [search, status, category, complianceFilter, navigate, location.search]);

  const { data: assets, isLoading } = useQuery({
    queryKey: ["assets", search, status, category],
    queryFn: () =>
      fetchAssets({
        search: search || undefined,
        status: status || undefined,
        category: category || undefined,
      }),
  });

  const filteredAssets = useMemo(() => {
    if (!assets) {
      return [];
    }

    if (!complianceFilter) {
      return assets;
    }

    return assets.filter((asset) => {
      const state = getNetworkComplianceState(asset.last_logged_in_date, today);
      if (complianceFilter === "warning") return state === "warning";
      if (complianceFilter === "overdue") return state === "overdue";
      if (complianceFilter === "unknown") return state === "unknown";
      return true;
    });
  }, [assets, complianceFilter, today]);

  const isEmpty = !isLoading && filteredAssets.length === 0;

  return (
    <div>
      <PageHeader title="Assets">
        <Button asChild>
          <Link to="/assets/new">
            <Plus className="mr-1.5 h-4 w-4" />
            Add Asset
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by asset tag, serial, assignee..."
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
            {ASSET_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(v) => setCategory(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            {ASSET_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={complianceFilter}
          onValueChange={(v) => setComplianceFilter(v === "ALL" ? "" : v)}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All Compliance States" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Compliance States</SelectItem>
            <SelectItem value="warning">Warning (25-29 days)</SelectItem>
            <SelectItem value="overdue">Needs Reimage (30+ days)</SelectItem>
            <SelectItem value="unknown">Unknown Login Date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isEmpty ? (
        <Card>
          <CardHeader>
            <CardTitle>No assets yet</CardTitle>
            <CardDescription>
              Add your first asset to start tracking assignments and repairs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/assets/new">Add Asset</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset Tag</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Logged In</TableHead>
                <TableHead>Days Since Login</TableHead>
                <TableHead>Days Until Removal</TableHead>
                <TableHead>Compliance</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Specific Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={12} className="py-8 text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : (
                filteredAssets.map((asset) => {
                  const complianceState = getNetworkComplianceState(asset.last_logged_in_date, today);
                  const daysSinceLogin = daysSinceLastLogin(asset.last_logged_in_date, today);
                  const daysUntilRemoval = daysUntilNetworkRemoval(asset.last_logged_in_date, today);

                  return (
                    <TableRow key={asset.id}>
                      <TableCell>
                        <Link
                          to={`/assets/${asset.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {asset.asset_tag || "Not set"}
                        </Link>
                      </TableCell>
                      <TableCell className="capitalize">{asset.category}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {[asset.manufacturer, asset.model].filter(Boolean).join(" ") || "-"}
                      </TableCell>
                      <TableCell>{asset.quantity_on_hand}</TableCell>
                      <TableCell>
                        <StatusBadge kind="asset" value={asset.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateValue(asset.last_logged_in_date)}
                      </TableCell>
                      <TableCell className={cn(complianceCellColors[complianceState])}>
                        {daysSinceLogin === null ? "Unknown" : daysSinceLogin}
                      </TableCell>
                      <TableCell className={cn(complianceCellColors[complianceState])}>
                        {daysUntilRemoval === null ? "Unknown" : daysUntilRemoval}
                      </TableCell>
                      <TableCell>
                        <AssetLifecycleBadge
                          lastLoggedInDate={asset.last_logged_in_date}
                          today={today}
                        />
                      </TableCell>
                      <TableCell>{asset.assigned_to_name || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{asset.location || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{asset.specific_location || "-"}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

