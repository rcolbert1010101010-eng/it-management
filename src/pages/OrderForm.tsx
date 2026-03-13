import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  createOrder,
  updateOrder,
  fetchOrder,
  fetchOrderLineItems,
  upsertOrderLineItems,
  ORDER_STATUSES,
  type OrderInsert,
  type OrderLineItemInsert,
} from "@/lib/api";
import { getOrderStatusLabel } from "@/lib/status";
import { useAppStore } from "@/lib/store";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

interface LineItemForm {
  id?: string;
  item_name: string;
  quantity: number;
  unit_cost: string;
  sku: string;
  received_quantity: number;
  notes: string;
}

const emptyLineItem: LineItemForm = {
  item_name: "",
  quantity: 1,
  unit_cost: "",
  sku: "",
  received_quantity: 0,
  notes: "",
};

export default function OrderForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const performedBy = useAppStore((s) => s.performedBy);

  const [form, setForm] = useState<Partial<OrderInsert>>({
    order_number: "",
    vendor_name: "",
    vendor_contact: "",
    requested_by_name: "",
    requested_by_email: "",
    status: "REQUESTED",
    order_date: "",
    expected_delivery_date: "",
    shipping_tracking_number: "",
    notes: "",
  });

  const [lineItems, setLineItems] = useState<LineItemForm[]>([{ ...emptyLineItem }]);

  // Load existing order data
  useQuery({
    queryKey: ["order-form", id],
    queryFn: async () => {
      const [order, items] = await Promise.all([
        fetchOrder(id!),
        fetchOrderLineItems(id!),
      ]);
      setForm({
        order_number: order.order_number,
        vendor_name: order.vendor_name,
        vendor_contact: order.vendor_contact || "",
        requested_by_name: order.requested_by_name || "",
        requested_by_email: order.requested_by_email || "",
        status: order.status,
        order_date: order.order_date || "",
        expected_delivery_date: order.expected_delivery_date || "",
        shipping_tracking_number: order.shipping_tracking_number || "",
        notes: order.notes || "",
      });
      setLineItems(
        items.length > 0
          ? items.map((li) => ({
              id: li.id,
              item_name: li.item_name,
              quantity: li.quantity,
              unit_cost: li.unit_cost != null ? String(li.unit_cost) : "",
              sku: li.sku || "",
              received_quantity: li.received_quantity ?? 0,
              notes: li.notes || "",
            }))
          : [{ ...emptyLineItem }]
      );
      return { order, items };
    },
    enabled: isEdit,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const orderData = {
        ...form,
        order_date: form.order_date || null,
        expected_delivery_date: form.expected_delivery_date || null,
        vendor_contact: form.vendor_contact || null,
        requested_by_name: form.requested_by_name || null,
        requested_by_email: form.requested_by_email || null,
        shipping_tracking_number: form.shipping_tracking_number || null,
        notes: form.notes || null,
      };

      const validItems = lineItems
        .filter((li) => li.item_name.trim())
        .map((li) => ({
          item_name: li.item_name,
          quantity: li.quantity,
          unit_cost: li.unit_cost ? parseFloat(li.unit_cost) : null,
          sku: li.sku || null,
          received_quantity: li.received_quantity,
          notes: li.notes || null,
        }));

      if (isEdit) {
        const result = await updateOrder(id!, orderData, performedBy);
        await upsertOrderLineItems(
          id!,
          validItems.map((li) => ({ ...li, order_id: id! }))
        );
        return result;
      }
      return createOrder(orderData as OrderInsert, validItems, performedBy);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["order-line-items", id] });
      toast.success(isEdit ? "Order updated" : "Order created");
      navigate(`/orders/${result.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const updateLineItem = (index: number, field: keyof LineItemForm, value: string | number) =>
    setLineItems((prev) =>
      prev.map((li, i) => (i === index ? { ...li, [field]: value } : li))
    );

  const addLineItem = () => setLineItems((prev) => [...prev, { ...emptyLineItem }]);

  const removeLineItem = (index: number) =>
    setLineItems((prev) => prev.filter((_, i) => i !== index));

  return (
    <div>
      <PageHeader
        title={isEdit ? "Edit Order" : "Create Order"}
        backTo={isEdit ? `/orders/${id}` : "/orders"}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="max-w-3xl space-y-6"
      >
        {/* Order Info */}
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-lg font-medium text-foreground">Order Info</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="order_number">Order Number *</Label>
              <Input
                id="order_number"
                required
                value={form.order_number || ""}
                onChange={(e) => update("order_number", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.status || "REQUESTED"}
                onValueChange={(v) => update("status", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {getOrderStatusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="vendor_name">Vendor Name *</Label>
              <Input
                id="vendor_name"
                required
                value={form.vendor_name || ""}
                onChange={(e) => update("vendor_name", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="vendor_contact">Vendor Contact</Label>
              <Input
                id="vendor_contact"
                value={form.vendor_contact || ""}
                onChange={(e) => update("vendor_contact", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="requested_by_name">Requested For (Name)</Label>
              <Input
                id="requested_by_name"
                value={form.requested_by_name || ""}
                onChange={(e) => update("requested_by_name", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="requested_by_email">Requested For (Email)</Label>
              <Input
                id="requested_by_email"
                type="email"
                value={form.requested_by_email || ""}
                onChange={(e) => update("requested_by_email", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="order_date">Order Date</Label>
              <Input
                id="order_date"
                type="date"
                value={form.order_date || ""}
                onChange={(e) => update("order_date", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="expected_delivery_date">Expected Delivery</Label>
              <Input
                id="expected_delivery_date"
                type="date"
                value={form.expected_delivery_date || ""}
                onChange={(e) => update("expected_delivery_date", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="shipping_tracking_number">Tracking Number</Label>
              <Input
                id="shipping_tracking_number"
                value={form.shipping_tracking_number || ""}
                onChange={(e) => update("shipping_tracking_number", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes || ""}
              onChange={(e) => update("notes", e.target.value)}
              rows={2}
            />
          </div>
        </div>

        {/* Line Items */}
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-foreground">Line Items</h2>
            <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Item
            </Button>
          </div>

          {lineItems.map((li, index) => (
            <div key={index} className="rounded border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Item {index + 1}
                </span>
                {lineItems.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeLineItem(index)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <Label>Item Name *</Label>
                  <Input
                    required
                    value={li.item_name}
                    onChange={(e) => updateLineItem(index, "item_name", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={li.quantity}
                    onChange={(e) =>
                      updateLineItem(index, "quantity", parseInt(e.target.value) || 1)
                    }
                  />
                </div>
                <div>
                  <Label>Unit Cost</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    value={li.unit_cost}
                    onChange={(e) => updateLineItem(index, "unit_cost", e.target.value)}
                  />
                </div>
                <div>
                  <Label>SKU</Label>
                  <Input
                    value={li.sku}
                    onChange={(e) => updateLineItem(index, "sku", e.target.value)}
                  />
                </div>
                <div className="md:col-span-3">
                  <Label>Notes</Label>
                  <Input
                    value={li.notes}
                    onChange={(e) => updateLineItem(index, "notes", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : isEdit ? "Update Order" : "Create Order"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(isEdit ? `/orders/${id}` : "/orders")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
