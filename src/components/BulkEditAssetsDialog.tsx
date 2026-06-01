import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ASSET_STATUSES,
  fetchAssetCategories,
  fetchLocations,
  type AssetBulkUpdate,
} from "@/lib/api";
import { getAssetStatusLabel } from "@/lib/status";
import { DatePickerField } from "@/components/DatePickerField";
import { LocationSelectField } from "@/components/LocationSelectField";
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

type BulkEditAssetsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onSubmit: (updates: AssetBulkUpdate) => void;
  isPending?: boolean;
};

type FieldKey = keyof AssetBulkUpdate;

export function BulkEditAssetsDialog({
  open,
  onOpenChange,
  selectedCount,
  onSubmit,
  isPending = false,
}: BulkEditAssetsDialogProps) {
  const [enabled, setEnabled] = useState<Record<FieldKey, boolean>>({
    status: false,
    category: false,
    location: false,
    specific_location: false,
    assigned_to_name: false,
    assigned_to_email: false,
    last_reimaged_date: false,
    last_logged_in_date: false,
  });
  const [values, setValues] = useState<Record<FieldKey, string>>({
    status: "IN_STOCK",
    category: "laptop",
    location: "",
    specific_location: "",
    assigned_to_name: "",
    assigned_to_email: "",
    last_reimaged_date: "",
    last_logged_in_date: "",
  });
  const [locationOptions, setLocationOptions] = useState<Awaited<ReturnType<typeof fetchLocations>>>([]);

  const { data: categoryOptions = [] } = useQuery({
    queryKey: ["asset-categories"],
    queryFn: fetchAssetCategories,
    enabled: open,
  });

  useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const locations = await fetchLocations();
      setLocationOptions(locations);
      return locations;
    },
    enabled: open,
  });

  const resetForm = () => {
    setEnabled({
      status: false,
      category: false,
      location: false,
      specific_location: false,
      assigned_to_name: false,
      assigned_to_email: false,
      last_reimaged_date: false,
      last_logged_in_date: false,
    });
    setValues({
      status: "IN_STOCK",
      category: categoryOptions[0] ?? "laptop",
      location: "",
      specific_location: "",
      assigned_to_name: "",
      assigned_to_email: "",
      last_reimaged_date: "",
      last_logged_in_date: "",
    });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const buildPatch = (): AssetBulkUpdate => {
    const patch: AssetBulkUpdate = {};
    if (enabled.status) patch.status = values.status;
    if (enabled.category) patch.category = values.category;
    if (enabled.location) patch.location = values.location;
    if (enabled.specific_location) patch.specific_location = values.specific_location;
    if (enabled.assigned_to_name) patch.assigned_to_name = values.assigned_to_name;
    if (enabled.assigned_to_email) patch.assigned_to_email = values.assigned_to_email;
    if (enabled.last_reimaged_date) patch.last_reimaged_date = values.last_reimaged_date || null;
    if (enabled.last_logged_in_date) patch.last_logged_in_date = values.last_logged_in_date || null;
    return patch;
  };

  const hasEnabledField = useMemo(() => Object.values(enabled).some(Boolean), [enabled]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk edit {selectedCount} asset{selectedCount === 1 ? "" : "s"}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Check the fields you want to update. Unchecked fields are left unchanged.
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-asset-status"
                checked={enabled.status}
                onCheckedChange={(checked) => setEnabled((prev) => ({ ...prev, status: checked === true }))}
              />
              <Label htmlFor="bulk-asset-status">Status</Label>
            </div>
            {enabled.status && (
              <Select value={values.status} onValueChange={(v) => setValues((prev) => ({ ...prev, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {getAssetStatusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-asset-category"
                checked={enabled.category}
                onCheckedChange={(checked) => setEnabled((prev) => ({ ...prev, category: checked === true }))}
              />
              <Label htmlFor="bulk-asset-category">Category</Label>
            </div>
            {enabled.category && (
              <Select value={values.category} onValueChange={(v) => setValues((prev) => ({ ...prev, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-asset-location"
                checked={enabled.location}
                onCheckedChange={(checked) => setEnabled((prev) => ({ ...prev, location: checked === true }))}
              />
              <Label htmlFor="bulk-asset-location">Location</Label>
            </div>
            {enabled.location && (
              <LocationSelectField
                value={values.location}
                options={locationOptions}
                onValueChange={(v) => setValues((prev) => ({ ...prev, location: v }))}
                onOptionsChange={setLocationOptions}
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-asset-specific-location"
                checked={enabled.specific_location}
                onCheckedChange={(checked) =>
                  setEnabled((prev) => ({ ...prev, specific_location: checked === true }))
                }
              />
              <Label htmlFor="bulk-asset-specific-location">Specific Location</Label>
            </div>
            {enabled.specific_location && (
              <Input
                value={values.specific_location}
                onChange={(e) => setValues((prev) => ({ ...prev, specific_location: e.target.value }))}
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-asset-assigned-name"
                checked={enabled.assigned_to_name}
                onCheckedChange={(checked) =>
                  setEnabled((prev) => ({ ...prev, assigned_to_name: checked === true }))
                }
              />
              <Label htmlFor="bulk-asset-assigned-name">Assigned To (Name)</Label>
            </div>
            {enabled.assigned_to_name && (
              <Input
                value={values.assigned_to_name}
                onChange={(e) => setValues((prev) => ({ ...prev, assigned_to_name: e.target.value }))}
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-asset-assigned-email"
                checked={enabled.assigned_to_email}
                onCheckedChange={(checked) =>
                  setEnabled((prev) => ({ ...prev, assigned_to_email: checked === true }))
                }
              />
              <Label htmlFor="bulk-asset-assigned-email">Assigned To (Email)</Label>
            </div>
            {enabled.assigned_to_email && (
              <Input
                type="email"
                value={values.assigned_to_email}
                onChange={(e) => setValues((prev) => ({ ...prev, assigned_to_email: e.target.value }))}
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-asset-last-reimaged"
                checked={enabled.last_reimaged_date}
                onCheckedChange={(checked) =>
                  setEnabled((prev) => ({ ...prev, last_reimaged_date: checked === true }))
                }
              />
              <Label htmlFor="bulk-asset-last-reimaged">Last Reimaged Date</Label>
            </div>
            {enabled.last_reimaged_date && (
              <DatePickerField
                value={values.last_reimaged_date}
                onChange={(v) => setValues((prev) => ({ ...prev, last_reimaged_date: v }))}
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-asset-last-login"
                checked={enabled.last_logged_in_date}
                onCheckedChange={(checked) =>
                  setEnabled((prev) => ({ ...prev, last_logged_in_date: checked === true }))
                }
              />
              <Label htmlFor="bulk-asset-last-login">Last Logged In Date</Label>
            </div>
            {enabled.last_logged_in_date && (
              <DatePickerField
                value={values.last_logged_in_date}
                onChange={(v) => setValues((prev) => ({ ...prev, last_logged_in_date: v }))}
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
