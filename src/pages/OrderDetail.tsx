import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import {
  fetchOrder,
  fetchOrderLineItems,
  deleteOrder,
  markOrderReceived,
  fetchAuditLog,
  createAssetsFromLineItem,
  ASSET_CATEGORIES,
} from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Trash2, PackageCheck, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const performedBy = useAppStore((s) => s.performedBy);

  const [showReceive, setShowReceive] = useState(false);
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});
  const [showCreateAssets, setShowCreateAssets] = useState(false);
  const [selectedLineItem, setSelectedLineItem] = useState<{
    id: string;
    item_name: string;
    quantity: number;
  } | null>(null);
  const [assetTags, setAssetTags] = useState<string[]>([]);
  const [assetCategory, setAssetCategory] = useState("laptop");

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => fetchOrder(id!),
    enabled: !!id,
  });

  const { data: lineItems } = useQuery({
    queryKey: ["order-line-items", id],
    queryFn: () => fetchOrderLineItems(id!),
    enabled: !!id,
  });

  const { data: auditEntries } = useQuery({
    queryKey: ["audit", "ORDER", id],
    queryFn: () => fetchAuditLog({ entityType: "ORDER", entityId: id }),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteOrder(id!, performedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order deleted");
      navigate("/orders");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const receiveMutation = useMutation({
    mutationFn: () => {
      const updates = Object.entries(receivedQtys).map(([liId, qty]) => ({
        id: liId,
        received_quantity: qty,
      }));
      return markOrderReceived(id!, updates, performedBy);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["order-line-items", id] });
      queryClient.invalidateQueries({ queryKey: ["audit", "ORDER", id] });
      setShowReceive(false);
      toast.success("Order marked as received");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createAssetsMutation = useMutation({
    mutationFn: () => {
      if (!selectedLineItem) throw new Error("No line item selected");
      const tags = assetTags.filter((t) => t.trim());
      if (tags.length === 0) throw new Error("Enter at least one asset tag");
      return createAssetsFromLineItem(id!, selectedLineItem.id, tags, assetCategory, performedBy);
    },
    onSuccess: (assets) => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      setShowCreateAssets(false);
      setSelectedLineItem(null);
      setAssetTags([]);
      toast.success(`Created ${assets.length} asset(s)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openReceiveDialog = () => {
    const qtys: Record<string, number> = {};
    lineItems?.forEach((li) => {
      qtys[li.id] = li.received_quantity ?? li.quantity;
    });
    setReceivedQtys(qtys);
    setShowReceive(true);
  };

  const openCreateAssetsDialog = (li: { id: string; item_name: string; quantity: number }) => {
    setSelectedLineItem(li);
    setAssetTags(Array.from({ length: li.quantity }, () => ""));
    setAssetCategory("laptop");
    setShowCreateAssets(true);
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading...</div>;
  if (!order) return <div className="py-8 text-center text-muted-foreground">Order not found</div>;

  const fields = [
    { label: "Order Number", value: order.order_number },
    { label: "Vendor", value: order.vendor_name },
    { label: "Vendor Contact", value: order.vendor_contact },
    { label: "Status", value: <StatusBadge kind="order" value={order.status} /> },
    { label: "Requested For", value: order.requested_by_name },
    { label: "Requester Email", value: order.requested_by_email },
    { label: "Order Date", value: order.order_date ? format(new Date(order.order_date), "MMM d, yyyy") : null },
    { label: "Expected Delivery", value: order.expected_delivery_date ? format(new Date(order.expected_delivery_date), "MMM d, yyyy") : null },
    { label: "Received Date", value: order.received_date ? format(new Date(order.received_date), "MMM d, yyyy") : null },
    { label: "Tracking #", value: order.shipping_tracking_number },
    { label: "Notes", value: order.notes },
  ];

  const totalCost = lineItems?.reduce((sum, li) => sum + (li.unit_cost || 0) * li.quantity, 0) || 0;

  return (
    <div>
      <PageHeader title={order.order_number} backTo="/orders">
        {order.status !== "RECEIVED" && order.status !== "CANCELLED" && (
          <Button variant="outline" onClick={openReceiveDialog}>
            <PackageCheck className="mr-1.5 h-4 w-4" />
            Mark Received
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link to={`/orders/${id}/edit`}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Edit
          </Link>
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            if (confirm("Delete this order and all its line items?")) deleteMutation.mutate();
          }}
        >
          <Trash2 className="mr-1.5 h-4 w-4" />
          Delete
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Order Details */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-lg font-medium text-foreground">Order Details</h2>
            <dl className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-3 text-sm">
              {fields.map(({ label, value }) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>
                    {typeof value === "string" || typeof value === "number"
                      ? value
                      : value || <span className="text-muted-foreground">—</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Line Items */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-lg font-medium text-foreground">Line Items</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                      No line items
                    </TableCell>
                  </TableRow>
                ) : (
                  lineItems?.map((li) => (
                    <TableRow key={li.id}>
                      <TableCell className="font-medium">{li.item_name}</TableCell>
                      <TableCell className="text-right">{li.quantity}</TableCell>
                      <TableCell className="text-right">
                        {li.unit_cost != null ? `$${Number(li.unit_cost).toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">{li.received_quantity ?? 0}</TableCell>
                      <TableCell className="text-muted-foreground">{li.sku || "—"}</TableCell>
                      <TableCell>
                        {order.status === "RECEIVED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openCreateAssetsDialog(li)}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Create Assets
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {totalCost > 0 && (
              <p className="mt-3 text-sm text-right text-muted-foreground">
                Total: <span className="font-medium text-foreground">${totalCost.toFixed(2)}</span>
              </p>
            )}
          </div>
        </div>

        {/* Activity */}
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

      {/* Mark Received Dialog */}
      <Dialog open={showReceive} onOpenChange={setShowReceive}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Order as Received</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Set received quantities for each line item.
            </p>
            {lineItems?.map((li) => (
              <div key={li.id} className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium">{li.item_name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">of {li.quantity}</span>
                  <Input
                    type="number"
                    min={0}
                    max={li.quantity}
                    className="w-20"
                    value={receivedQtys[li.id] ?? 0}
                    onChange={(e) =>
                      setReceivedQtys((prev) => ({
                        ...prev,
                        [li.id]: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceive(false)}>
              Cancel
            </Button>
            <Button onClick={() => receiveMutation.mutate()} disabled={receiveMutation.isPending}>
              {receiveMutation.isPending ? "Saving..." : "Confirm Received"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Assets Dialog */}
      <Dialog open={showCreateAssets} onOpenChange={setShowCreateAssets}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Assets from "{selectedLineItem?.item_name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category</Label>
              <Select value={assetCategory} onValueChange={setAssetCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Asset Tags ({assetTags.length} — leave blank to fill later)
              </Label>
              {assetTags.map((tag, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                  <Input
                    placeholder={`Asset tag ${i + 1}`}
                    value={tag}
                    onChange={(e) => {
                      const newTags = [...assetTags];
                      newTags[i] = e.target.value;
                      setAssetTags(newTags);
                    }}
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAssetTags([...assetTags, ""])}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add Another
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateAssets(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createAssetsMutation.mutate()}
              disabled={createAssetsMutation.isPending}
            >
              {createAssetsMutation.isPending ? "Creating..." : "Create Assets"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
