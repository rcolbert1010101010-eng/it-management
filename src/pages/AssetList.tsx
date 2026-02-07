import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { fetchAssets, ASSET_STATUSES, ASSET_CATEGORIES } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [category, setCategory] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = decodeParam(params.get("status"));
    const categoryParam = decodeParam(params.get("category"));
    const searchParam = decodeParam(params.get("q"));

    if (statusParam !== null) setStatus(statusParam);
    if (categoryParam !== null) setCategory(categoryParam);
    if (searchParam !== null) setSearch(searchParam);
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (status) params.set("status", status);
    if (category) params.set("category", category);

    const next = params.toString();
    const current = location.search.startsWith("?") ? location.search.slice(1) : location.search;
    if (next !== current) {
      navigate(next ? `?${next}` : "", { replace: true });
    }
  }, [search, status, category, navigate, location.search]);

  const { data: assets, isLoading } = useQuery({
    queryKey: ["assets", search, status, category],
    queryFn: () =>
      fetchAssets({
        search: search || undefined,
        status: status || undefined,
        category: category || undefined,
      }),
  });

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
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset Tag</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Location</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : assets?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No assets found
                </TableCell>
              </TableRow>
            ) : (
              assets?.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell>
                    <Link
                      to={`/assets/${asset.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {asset.asset_tag}
                    </Link>
                  </TableCell>
                  <TableCell className="capitalize">{asset.category}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {[asset.manufacturer, asset.model].filter(Boolean).join(" ") || "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={asset.status} type="asset" />
                  </TableCell>
                  <TableCell>{asset.assigned_to_name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{asset.location || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
