import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import {
  fetchOrder,
  fetchOrderLineItems,
  deleteOrder,
  markOrderReceived,
  fetchAuditLog,
  fetchOrderLineItemAssetLinks,
  generateAssetFromOrderLineItem,
} from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Pencil, Trash2, PackageCheck, AlertTriangle, Link2, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const performedBy = useAppStore((s) => s.performedBy);

  const [showReceive, setShowReceive] = useState(false);
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});
  const [showGenerateAsset, setShowGenerateAsset] = useState(false);
  const [selectedLineItem, setSelectedLineItem] = useState<{
    id: string;
    item_name: string;
    quantity: number;
    notes: string | null;
    unit_cost: number | null;
  } | null>(null);
  const [assetTagInput, setAssetTagInput] = useState("");

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

  const { data: lineItemAssetLinks } = useQuery({
    queryKey: ["order-line-item-assets", id],
    queryFn: () => fetchOrderLineItemAssetLinks(id!),
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
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      setShowReceive(false);
      toast.success("Order marked as received");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateAssetMutation = useMutation({
    mutationFn: () => {
      if (!selectedLineItem) throw new Error("No line item selected");
      return generateAssetFromOrderLineItem(id!, selectedLineItem.id, performedBy, assetTagInput);
    },
    onSuccess: (generatedAsset) => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["order-line-item-assets", id] });
      queryClient.invalidateQueries({ queryKey: ["order-line-items", id] });
      setShowGenerateAsset(false);
      setSelectedLineItem(null);
      setAssetTagInput("");
      toast.success(`Asset generated: ${generatedAsset.asset_tag}`);
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

  const openGenerateAssetDialog = (li: {
    id: string;
    item_name: string;
    quantity: number;
    notes: string | null;
    unit_cost: number | null;
  }) => {
    setSelectedLineItem(li);
    setAssetTagInput("");
    setShowGenerateAsset(true);
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
  const linksByLineItemId = (lineItemAssetLinks ?? []).reduce<
    Record<string, NonNullable<typeof lineItemAssetLinks>[number][]>
  >(
    (acc, link) => {
      if (!link.source_order_line_item_id) return acc;
      const existing = acc[link.source_order_line_item_id] ?? [];
      acc[link.source_order_line_item_id] = [...existing, link];
      return acc;
    },
    {}
  );

  const getLineItemLinks = (lineItemId: string) => linksByLineItemId[lineItemId] ?? [];
  const hasLinkedAsset = (lineItemId: string) => getLineItemLinks(lineItemId).length > 0;
  const receivingWithoutAssetLinks = (lineItems ?? []).filter(
    (lineItem) => (receivedQtys[lineItem.id] ?? 0) > 0 && !hasLinkedAsset(lineItem.id)
  );

  return (
    <div>
      <PageHeader title={order.order_number} backTo="/orders">
        {order.status !== "CANCELLED" && (
          <Button variant="outline" onClick={openReceiveDialog}>
            <PackageCheck className="mr-1.5 h-4 w-4" />
            {order.status === "RECEIVED" ? "Update Received" : "Mark Received"}
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
                  <TableHead>Asset Link</TableHead>
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
                    <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                      No line items
                    </TableCell>
                  </TableRow>
                ) : (
                  lineItems?.map((li) => (
                    <TableRow key={li.id}>
                      <TableCell className="font-medium">{li.item_name}</TableCell>
                      <TableCell>
                        {hasLinkedAsset(li.id) ? (
                          <div className="space-y-1">
                            <div className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              <Link2 className="mr-1 h-3 w-3" />
                              Linked ({getLineItemLinks(li.id).length})
                            </div>
                            {getLineItemLinks(li.id)[0]?.asset_tag && (
                              <p className="text-xs text-muted-foreground">
                                Tag: {getLineItemLinks(li.id)[0].asset_tag}
                              </p>
                            )}
                            {getLineItemLinks(li.id).some((link) => link.generated_from_order) && (
                              <p className="text-xs text-muted-foreground">Generated from order</p>
                            )}
                          </div>
                        ) : (
                          <div className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Missing link
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{li.quantity}</TableCell>
                      <TableCell className="text-right">
                        {li.unit_cost != null ? `$${Number(li.unit_cost).toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">{li.received_quantity ?? 0}</TableCell>
                      <TableCell className="text-muted-foreground">{li.sku || "—"}</TableCell>
                      <TableCell>
                        {!hasLinkedAsset(li.id) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openGenerateAssetDialog(li)}
                            disabled={generateAssetMutation.isPending}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Generate Asset
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Asset-backed</span>
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
              Set received quantities for each line item. Receiving is blocked for lines that are missing an asset link; edit the order line first.
            </p>
            {receivingWithoutAssetLinks.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <p className="font-medium">Fix these order line asset links before receiving:</p>
                <ul className="mt-1 list-disc pl-4">
                  {receivingWithoutAssetLinks.map((lineItem) => (
                    <li key={lineItem.id}>
                      {lineItem.item_name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {lineItems?.map((li) => (
              <div key={li.id} className="flex items-center justify-between gap-4 rounded-md border p-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{li.item_name}</p>
                  {!hasLinkedAsset(li.id) ? (
                    <p className="mt-0.5 text-xs text-amber-700">No linked asset yet</p>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground">Linked to {getLineItemLinks(li.id).length} asset(s)</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">of {li.quantity}</span>
                  <Input
                    type="number"
                    min={0}
                    max={li.quantity}
                    className="w-20"
                    value={receivedQtys[li.id] ?? 0}
                    onChange={(e) => {
                      const parsed = Number.parseInt(e.target.value, 10);
                      const safe = Number.isFinite(parsed)
                        ? Math.max(0, Math.min(li.quantity, parsed))
                        : 0;
                      setReceivedQtys((prev) => ({
                        ...prev,
                        [li.id]: safe,
                      }));
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceive(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => receiveMutation.mutate()}
              disabled={receiveMutation.isPending || receivingWithoutAssetLinks.length > 0}
            >
              {receiveMutation.isPending ? "Saving..." : "Confirm Received"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Asset Dialog */}
      <Dialog open={showGenerateAsset} onOpenChange={setShowGenerateAsset}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Asset from Order Line</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This creates an asset record prefilled from the order line and links this line item to it so receiving can safely update inventory.
            </p>
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
              <p><span className="font-medium">Item:</span> {selectedLineItem?.item_name || "—"}</p>
              <p><span className="font-medium">Ordered Qty:</span> {selectedLineItem?.quantity ?? "—"}</p>
              <p>
                <span className="font-medium">Unit Cost:</span>{" "}
                {selectedLineItem?.unit_cost != null ? `$${Number(selectedLineItem.unit_cost).toFixed(2)}` : "—"}
              </p>
              <p><span className="font-medium">Description:</span> {selectedLineItem?.notes || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Asset Tag (optional)</p>
              <Input
                value={assetTagInput}
                onChange={(e) => setAssetTagInput(e.target.value)}
                placeholder="Leave blank to auto-generate (ASSET-YYYYMMDD-HHMMSS-RANDOM4)"
              />
              <p className="text-xs text-muted-foreground">
                If left blank, a unique tag is generated automatically.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowGenerateAsset(false);
                setAssetTagInput("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => generateAssetMutation.mutate()}
              disabled={generateAssetMutation.isPending}
            >
              {generateAssetMutation.isPending ? "Generating..." : "Generate Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
