import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import { fetchAsset, deleteAsset, fetchAuditLog } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const performedBy = useAppStore((s) => s.performedBy);

  const { data: asset, isLoading } = useQuery({
    queryKey: ["asset", id],
    queryFn: () => fetchAsset(id!),
    enabled: !!id,
  });

  const { data: auditEntries } = useQuery({
    queryKey: ["audit", "ASSET", id],
    queryFn: () => fetchAuditLog({ entityType: "ASSET", entityId: id }),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAsset(id!, performedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Asset deleted");
      navigate("/assets");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading...</div>;
  if (!asset) return <div className="py-8 text-center text-muted-foreground">Asset not found</div>;

  const fields = [
    { label: "Asset Tag", value: asset.asset_tag },
    { label: "Category", value: asset.category, capitalize: true },
    { label: "Quantity On Hand", value: asset.quantity_on_hand },
    { label: "Status", value: <StatusBadge kind="asset" value={asset.status} /> },
    { label: "Manufacturer", value: asset.manufacturer },
    { label: "Model", value: asset.model },
    { label: "Serial Number", value: asset.serial_number },
    { label: "Assigned To", value: asset.assigned_to_name },
    { label: "Assigned Email", value: asset.assigned_to_email },
    { label: "Location", value: asset.location },
    { label: "Purchase Date", value: asset.purchase_date ? format(new Date(asset.purchase_date), "MMM d, yyyy") : null },
    { label: "Warranty End", value: asset.warranty_end_date ? format(new Date(asset.warranty_end_date), "MMM d, yyyy") : null },
    { label: "Notes", value: asset.notes },
  ];

  return (
    <div>
      <PageHeader title={asset.asset_tag} backTo="/assets">
        <Button variant="outline" asChild>
          <Link to={`/assets/${id}/edit`}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Edit
          </Link>
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            if (confirm("Delete this asset?")) deleteMutation.mutate();
          }}
        >
          <Trash2 className="mr-1.5 h-4 w-4" />
          Delete
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-medium text-foreground">Details</h2>
          <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-sm">
            {fields.map(({ label, value, capitalize }) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className={capitalize ? "capitalize" : ""}>
                  {typeof value === "string" || typeof value === "number"
                    ? value
                    : value || <span className="text-muted-foreground">—</span>}
                </dd>
              </div>
            ))}
          </dl>
          {asset.source_order_id && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Created from order:{" "}
                <Link to={`/orders/${asset.source_order_id}`} className="text-primary hover:underline">
                  View Order
                </Link>
              </p>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-medium text-foreground">Activity</h2>
          {auditEntries?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded</p>
          ) : (
            <div className="space-y-3">
              {auditEntries?.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 text-sm">
                  <div className="mt-0.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  <div>
                    <p className="text-foreground">
                      <span className="font-medium">{entry.action}</span>
                      {" by "}
                      <span className="text-muted-foreground">{entry.performed_by}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(entry.timestamp), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
