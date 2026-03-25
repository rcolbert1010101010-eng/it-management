import { useState, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useParams } from "react-router-dom";
import {
  createAsset,
  updateAsset,
  fetchAsset,
  fetchLocations,
  createLocation,
  findMatchingLocation,
  trimLocationName,
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  type AssetInsert,
} from "@/lib/api";
import {
  daysSinceLastLogin,
  daysUntilNetworkRemoval,
} from "@/lib/assetLifecycle";
import { useTodayDate } from "@/lib/dateNow";
import { useAppStore } from "@/lib/store";
import { AssetLifecycleBadge } from "@/components/AssetLifecycleBadge";
import { DatePickerField } from "@/components/DatePickerField";
import { PageHeader } from "@/components/PageHeader";
import { BarcodeScannerDialog } from "@/components/BarcodeScannerDialog";
import { LocationSelectField } from "@/components/LocationSelectField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function AssetForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const performedBy = useAppStore((s) => s.performedBy);
  const today = useTodayDate();

  const [form, setForm] = useState<Partial<AssetInsert>>({
    asset_tag: "",
    category: "laptop",
    status: "IN_STOCK",
    manufacturer: "",
    model: "",
    serial_number: "",
    assigned_to_name: "",
    assigned_to_email: "",
    location: "",
    specific_location: "",
    purchase_date: "",
    warranty_end_date: "",
    last_reimaged_date: "",
    last_logged_in_date: "",
    notes: "",
    is_consumable: false,
    quantity_on_hand: 1,
  });
  const [scannerOpen, setScannerOpen] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [isCreatingLocation, setIsCreatingLocation] = useState(false);

  // Fetch all distinct categories from the database
  const { data: dbCategories } = useQuery({
    queryKey: ["asset-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("category")
        .order("category");
      if (error) throw error;
      const unique = [...new Set(data.map((r) => r.category))];
      return unique;
    },
  });

  const allCategories = useMemo(() => {
    const defaults = [...ASSET_CATEGORIES] as string[];
    const extras = (dbCategories || []).filter((c) => !defaults.includes(c));
    return [...defaults, ...extras];
  }, [dbCategories]);

  const { data: locationRows = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: fetchLocations,
  });

  const locationOptions = useMemo(() => {
    const locations = [...locationRows];
    const currentLocation = trimLocationName(form.location);
    if (currentLocation && !findMatchingLocation(currentLocation, locations)) {
      locations.push({
        id: `legacy-${currentLocation.toLowerCase()}`,
        name: currentLocation,
        created_at: new Date(0).toISOString(),
      });
    }
    return locations.sort((a, b) => a.name.localeCompare(b.name));
  }, [form.location, locationRows]);

  useQuery({
    queryKey: ["asset", id],
    queryFn: () => fetchAsset(id!),
    enabled: isEdit,
    meta: { onSuccess: true },
    refetchOnMount: true,
  });

  // Load existing asset data
  useQuery({
    queryKey: ["asset-form", id],
    queryFn: async () => {
      const asset = await fetchAsset(id!);
      const isKnownCategory = allCategories.includes(asset.category);
      setForm({
        asset_tag: asset.asset_tag || "",
        category: isKnownCategory ? asset.category : "custom",
        status: asset.status,
        manufacturer: asset.manufacturer || "",
        model: asset.model || "",
        serial_number: asset.serial_number || "",
        assigned_to_name: asset.assigned_to_name || "",
        assigned_to_email: asset.assigned_to_email || "",
        location: asset.location || "",
        specific_location: asset.specific_location || "",
        purchase_date: asset.purchase_date || "",
        warranty_end_date: asset.warranty_end_date || "",
        last_reimaged_date: asset.last_reimaged_date || "",
        last_logged_in_date: asset.last_logged_in_date || "",
        notes: asset.notes || "",
        is_consumable: asset.is_consumable || false,
        quantity_on_hand: asset.quantity_on_hand ?? 1,
      });
      if (!isKnownCategory) {
        setShowCustomCategory(true);
        setCustomCategory(asset.category);
      }
      return asset;
    },
    enabled: isEdit,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const resolvedCategory = showCustomCategory ? customCategory : form.category;
      const resolvedLocation = findMatchingLocation(form.location, locationOptions)?.name
        || trimLocationName(form.location);
      const parsedQuantity = Number(form.quantity_on_hand);
      const quantityOnHand = Number.isInteger(parsedQuantity) && parsedQuantity >= 0
        ? parsedQuantity
        : 0;
      const data = {
        ...form,
        asset_tag: form.is_consumable ? (form.asset_tag || null) : form.asset_tag,
        category: resolvedCategory || "other",
        quantity_on_hand: form.is_consumable ? quantityOnHand : 1,
        purchase_date: form.purchase_date || null,
        warranty_end_date: form.warranty_end_date || null,
        last_reimaged_date: form.last_reimaged_date || null,
        last_logged_in_date: form.last_logged_in_date || null,
        manufacturer: form.manufacturer || null,
        model: form.model || null,
        serial_number: form.serial_number || null,
        assigned_to_name: form.assigned_to_name || null,
        assigned_to_email: form.assigned_to_email || null,
        location: resolvedLocation || null,
        specific_location: trimLocationName(form.specific_location) || null,
        notes: form.notes || null,
      };
      if (isEdit) {
        return updateAsset(id!, data, performedBy);
      }
      return createAsset(data as AssetInsert, performedBy);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset", id] });
      queryClient.invalidateQueries({ queryKey: ["asset-categories"] });
      toast.success(isEdit ? "Asset updated" : "Asset created");
      navigate(`/assets/${result.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = (field: string, value: string | boolean | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const parseQuantityInput = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, parsed);
  };

  const handleCategoryChange = (value: string) => {
    if (value === "custom") {
      setShowCustomCategory(true);
      update("category", "custom");
    } else {
      setShowCustomCategory(false);
      setCustomCategory("");
      update("category", value);
    }
  };

  const handleCreateLocation = async (value: string) => {
    setIsCreatingLocation(true);
    try {
      const location = await createLocation(value);
      queryClient.setQueryData(["locations"], (current: typeof locationRows | undefined) => {
        const next = current ? [...current] : [];
        if (!findMatchingLocation(location.name, next)) {
          next.push(location);
        }
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      update("location", location.name);
      toast.success(`Location "${location.name}" ready to use.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create location.";
      toast.error(message);
      throw error;
    } finally {
      setIsCreatingLocation(false);
    }
  };

  const daysSinceLogin = daysSinceLastLogin(form.last_logged_in_date ?? null, today);
  const daysUntilRemoval = daysUntilNetworkRemoval(form.last_logged_in_date ?? null, today);

  return (
    <div>
      <PageHeader
        title={isEdit ? "Edit Asset" : "Create Asset"}
        backTo={isEdit ? `/assets/${id}` : "/assets"}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.is_consumable && !form.asset_tag) {
            toast.error("Asset Tag is required for non-consumable items.");
            return;
          }
          if (showCustomCategory && !customCategory.trim()) {
            toast.error("Please enter a custom category name.");
            return;
          }
          const parsedQuantity = Number(form.quantity_on_hand);
          if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
            toast.error("Quantity On Hand must be a non-negative whole number.");
            return;
          }
          mutation.mutate();
        }}
        className="max-w-2xl space-y-6"
      >
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="asset_tag">
                Asset Tag {!form.is_consumable && "*"}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="asset_tag"
                  required={!form.is_consumable}
                  value={form.asset_tag || ""}
                  onChange={(e) => update("asset_tag", e.target.value)}
                  placeholder={form.is_consumable ? "Optional for consumables" : ""}
                />
                <Button type="button" variant="outline" onClick={() => setScannerOpen(true)}>
                  Scan
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Checkbox
                  id="is_consumable"
                  checked={form.is_consumable || false}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      is_consumable: checked === true,
                      quantity_on_hand: checked === true ? prev.quantity_on_hand ?? 1 : 1,
                    }))
                  }
                />
                <Label htmlFor="is_consumable" className="text-sm font-normal cursor-pointer">
                  Consumable
                </Label>
              </div>
            </div>
            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                value={showCustomCategory ? "custom" : (form.category || "laptop")}
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">+ Add Custom...</SelectItem>
                </SelectContent>
              </Select>
              {showCustomCategory && (
                <Input
                  className="mt-2"
                  placeholder="Enter custom category"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  autoFocus
                />
              )}
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={form.status || "IN_STOCK"} onValueChange={(v) => update("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="serial_number">Serial Number</Label>
              <Input
                id="serial_number"
                value={form.serial_number || ""}
                onChange={(e) => update("serial_number", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input
                id="manufacturer"
                value={form.manufacturer || ""}
                onChange={(e) => update("manufacturer", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="quantity_on_hand">Quantity On Hand *</Label>
              <Input
                id="quantity_on_hand"
                type="number"
                min={0}
                step={1}
                required
                disabled={!form.is_consumable}
                value={form.quantity_on_hand ?? 1}
                onChange={(e) => update("quantity_on_hand", parseQuantityInput(e.target.value))}
              />
              {!form.is_consumable && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Non-consumables default to 1.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={form.model || ""}
                onChange={(e) => update("model", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="assigned_to_name">Assigned To (Name)</Label>
              <Input
                id="assigned_to_name"
                value={form.assigned_to_name || ""}
                onChange={(e) => update("assigned_to_name", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="assigned_to_email">Assigned To (Email)</Label>
              <Input
                id="assigned_to_email"
                type="email"
                value={form.assigned_to_email || ""}
                onChange={(e) => update("assigned_to_email", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <LocationSelectField
                id="location"
                value={form.location || ""}
                options={locationOptions}
                onValueChange={(value) => update("location", value)}
                onCreateOption={handleCreateLocation}
                isCreating={isCreatingLocation}
              />
            </div>
            <div>
              <Label htmlFor="specific_location">Specific Location</Label>
              <Input
                id="specific_location"
                value={form.specific_location || ""}
                onChange={(e) => update("specific_location", e.target.value)}
                placeholder="Shelf, office, room, etc."
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="purchase_date">Purchase Date</Label>
              <DatePickerField
                id="purchase_date"
                value={form.purchase_date || ""}
                onChange={(value) => update("purchase_date", value)}
              />
            </div>
            <div>
              <Label htmlFor="warranty_end_date">Warranty End Date</Label>
              <DatePickerField
                id="warranty_end_date"
                value={form.warranty_end_date || ""}
                onChange={(value) => update("warranty_end_date", value)}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-md border border-dashed p-4">
            <div>
              <h2 className="text-sm font-medium text-foreground">Lifecycle / Network Compliance</h2>
              <p className="text-sm text-muted-foreground">
                Track reimage activity and last network login without persisting derived counters.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="last_reimaged_date">Last Reimaged Date</Label>
                <DatePickerField
                  id="last_reimaged_date"
                  value={form.last_reimaged_date || ""}
                  onChange={(value) => update("last_reimaged_date", value)}
                />
              </div>
              <div>
                <Label htmlFor="last_logged_in_date">Last Logged In Date</Label>
                <DatePickerField
                  id="last_logged_in_date"
                  value={form.last_logged_in_date || ""}
                  onChange={(value) => update("last_logged_in_date", value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1 rounded-md bg-muted/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Compliance Status</p>
                <AssetLifecycleBadge
                  lastLoggedInDate={form.last_logged_in_date ?? null}
                  today={today}
                />
              </div>
              <div className="space-y-1 rounded-md bg-muted/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Days Since Last Login
                </p>
                <p className="text-sm font-medium text-foreground">
                  {daysSinceLogin === null ? "Unknown" : daysSinceLogin}
                </p>
              </div>
              <div className="space-y-1 rounded-md bg-muted/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Days Until Network Removal
                </p>
                <p className="text-sm font-medium text-foreground">
                  {daysUntilRemoval === null ? "Unknown" : daysUntilRemoval}
                </p>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes || ""}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : isEdit ? "Update Asset" : "Create Asset"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(isEdit ? `/assets/${id}` : "/assets")}
          >
            Cancel
          </Button>
        </div>
      </form>

      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={(value) => update("asset_tag", value.trim())}
      />
    </div>
  );
}
