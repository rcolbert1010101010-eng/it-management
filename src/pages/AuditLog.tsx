import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchAuditLog } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
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
import { Link } from "react-router-dom";

export default function AuditLog() {
  const [entityType, setEntityType] = useState<string>("");

  const { data: entries, isLoading } = useQuery({
    queryKey: ["audit-log", entityType],
    queryFn: () => fetchAuditLog({ entityType: entityType || undefined }),
  });

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

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Performed By</TableHead>
              <TableHead>Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : entries?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No audit entries found
                </TableCell>
              </TableRow>
            ) : (
              entries?.map((entry) => {
                const details = entry.details as Record<string, unknown> | null;
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {format(new Date(entry.timestamp), "MMM d, yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground">
                        {entry.entity_type}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{entry.action}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                      {details
                        ? Object.entries(details)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ")
                        : "—"}
                    </TableCell>
                    <TableCell>{entry.performed_by}</TableCell>
                    <TableCell>
                      <Link
                        to={`/${entry.entity_type === "ASSET" ? "assets" : "orders"}/${entry.entity_id}`}
                        className="text-primary hover:underline text-sm"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
