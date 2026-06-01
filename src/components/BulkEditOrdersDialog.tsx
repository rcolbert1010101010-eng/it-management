import { useMemo, useState } from "react";
import { ORDER_STATUSES, type OrderBulkUpdate } from "@/lib/api";
import { getOrderStatusLabel } from "@/lib/status";
import { DatePickerField } from "@/components/DatePickerField";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type BulkEditOrdersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onSubmit: (updates: OrderBulkUpdate) => void;
  isPending?: boolean;
};

type FieldKey = keyof OrderBulkUpdate;

export function BulkEditOrdersDialog({
  open,
  onOpenChange,
  selectedCount,
  onSubmit,
  isPending = false,
}: BulkEditOrdersDialogProps) {
  const [enabled, setEnabled] = useState<Record<FieldKey, boolean>>({
    status: false,
    vendor_name: false,
    requested_by_name: false,
    requested_by_email: false,
    order_date: false,
    expected_delivery_date: false,
    received_date: false,
    notes: false,
  });
  const [values, setValues] = useState<Record<FieldKey, string>>({
    status: "REQUESTED",
    vendor_name: "",
    requested_by_name: "",
    requested_by_email: "",
    order_date: "",
    expected_delivery_date: "",
    received_date: "",
    notes: "",
  });

  const resetForm = () => {
    setEnabled({
      status: false,
      vendor_name: false,
      requested_by_name: false,
      requested_by_email: false,
      order_date: false,
      expected_delivery_date: false,
      received_date: false,
      notes: false,
    });
    setValues({
      status: "REQUESTED",
      vendor_name: "",
      requested_by_name: "",
      requested_by_email: "",
      order_date: "",
      expected_delivery_date: "",
      received_date: "",
      notes: "",
    });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const buildPatch = (): OrderBulkUpdate => {
    const patch: OrderBulkUpdate = {};
    if (enabled.status) patch.status = values.status;
    if (enabled.vendor_name) patch.vendor_name = values.vendor_name;
    if (enabled.requested_by_name) patch.requested_by_name = values.requested_by_name;
    if (enabled.requested_by_email) patch.requested_by_email = values.requested_by_email;
    if (enabled.order_date) patch.order_date = values.order_date || null;
    if (enabled.expected_delivery_date) patch.expected_delivery_date = values.expected_delivery_date || null;
    if (enabled.received_date) patch.received_date = values.received_date || null;
    if (enabled.notes) patch.notes = values.notes;
    return patch;
  };

  const hasEnabledField = useMemo(() => Object.values(enabled).some(Boolean), [enabled]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk edit {selectedCount} order{selectedCount === 1 ? "" : "s"}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Check the fields you want to update. Unchecked fields are left unchanged.
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-order-status"
                checked={enabled.status}
                onCheckedChange={(checked) => setEnabled((prev) => ({ ...prev, status: checked === true }))}
              />
              <Label htmlFor="bulk-order-status">Status</Label>
            </div>
            {enabled.status && (
              <Select value={values.status} onValueChange={(v) => setValues((prev) => ({ ...prev, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {getOrderStatusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-order-vendor"
                checked={enabled.vendor_name}
                onCheckedChange={(checked) => setEnabled((prev) => ({ ...prev, vendor_name: checked === true }))}
              />
              <Label htmlFor="bulk-order-vendor">Vendor</Label>
            </div>
            {enabled.vendor_name && (
              <Input
                value={values.vendor_name}
                onChange={(e) => setValues((prev) => ({ ...prev, vendor_name: e.target.value }))}
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-order-requested-name"
                checked={enabled.requested_by_name}
                onCheckedChange={(checked) =>
                  setEnabled((prev) => ({ ...prev, requested_by_name: checked === true }))
                }
              />
              <Label htmlFor="bulk-order-requested-name">Requested For (Name)</Label>
            </div>
            {enabled.requested_by_name && (
              <Input
                value={values.requested_by_name}
                onChange={(e) => setValues((prev) => ({ ...prev, requested_by_name: e.target.value }))}
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-order-requested-email"
                checked={enabled.requested_by_email}
                onCheckedChange={(checked) =>
                  setEnabled((prev) => ({ ...prev, requested_by_email: checked === true }))
                }
              />
              <Label htmlFor="bulk-order-requested-email">Requested For (Email)</Label>
            </div>
            {enabled.requested_by_email && (
              <Input
                type="email"
                value={values.requested_by_email}
                onChange={(e) => setValues((prev) => ({ ...prev, requested_by_email: e.target.value }))}
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-order-order-date"
                checked={enabled.order_date}
                onCheckedChange={(checked) => setEnabled((prev) => ({ ...prev, order_date: checked === true }))}
              />
              <Label htmlFor="bulk-order-order-date">Order Date</Label>
            </div>
            {enabled.order_date && (
              <DatePickerField
                value={values.order_date}
                onChange={(v) => setValues((prev) => ({ ...prev, order_date: v }))}
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-order-expected-date"
                checked={enabled.expected_delivery_date}
                onCheckedChange={(checked) =>
                  setEnabled((prev) => ({ ...prev, expected_delivery_date: checked === true }))
                }
              />
              <Label htmlFor="bulk-order-expected-date">Expected Delivery</Label>
            </div>
            {enabled.expected_delivery_date && (
              <DatePickerField
                value={values.expected_delivery_date}
                onChange={(v) => setValues((prev) => ({ ...prev, expected_delivery_date: v }))}
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-order-received-date"
                checked={enabled.received_date}
                onCheckedChange={(checked) => setEnabled((prev) => ({ ...prev, received_date: checked === true }))}
              />
              <Label htmlFor="bulk-order-received-date">Received Date</Label>
            </div>
            {enabled.received_date && (
              <DatePickerField
                value={values.received_date}
                onChange={(v) => setValues((prev) => ({ ...prev, received_date: v }))}
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-order-notes"
                checked={enabled.notes}
                onCheckedChange={(checked) => setEnabled((prev) => ({ ...prev, notes: checked === true }))}
              />
              <Label htmlFor="bulk-order-notes">Notes (replace)</Label>
            </div>
            {enabled.notes && (
              <Textarea
                rows={3}
                value={values.notes}
                onChange={(e) => setValues((prev) => ({ ...prev, notes: e.target.value }))}
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending || !hasEnabledField}
            onClick={() => onSubmit(buildPatch())}
          >
            {isPending ? "Updating..." : `Update ${selectedCount}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
