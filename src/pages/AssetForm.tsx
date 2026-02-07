import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { createAsset, updateAsset, fetchAsset, ASSET_CATEGORIES, ASSET_STATUSES, type AssetInsert } from "@/lib/api";
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
import { toast } from "sonner";

export default function AssetForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const performedBy = useAppStore((s) => s.performedBy);

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
    purchase_date: "",
    warranty_end_date: "",
    notes: "",
  });

  const { isLoading: loadingAsset } = useQuery({
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
      setForm({
        asset_tag: asset.asset_tag,
        category: asset.category,
        status: asset.status,
        manufacturer: asset.manufacturer || "",
        model: asset.model || "",
        serial_number: asset.serial_number || "",
        assigned_to_name: asset.assigned_to_name || "",
        assigned_to_email: asset.assigned_to_email || "",
        location: asset.location || "",
        purchase_date: asset.purchase_date || "",
        warranty_end_date: asset.warranty_end_date || "",
        notes: asset.notes || "",
      });
      return asset;
    },
    enabled: isEdit,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const data = {
        ...form,
        purchase_date: form.purchase_date || null,
        warranty_end_date: form.warranty_end_date || null,
        manufacturer: form.manufacturer || null,
        model: form.model || null,
        serial_number: form.serial_number || null,
        assigned_to_name: form.assigned_to_name || null,
        assigned_to_email: form.assigned_to_email || null,
        location: form.location || null,
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
      toast.success(isEdit ? "Asset updated" : "Asset created");
      navigate(`/assets/${result.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div>
      <PageHeader
        title={isEdit ? "Edit Asset" : "Create Asset"}
        backTo={isEdit ? `/assets/${id}` : "/assets"}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="max-w-2xl space-y-6"
      >
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="asset_tag">Asset Tag *</Label>
              <Input
                id="asset_tag"
                required
                value={form.asset_tag || ""}
                onChange={(e) => update("asset_tag", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="category">Category *</Label>
              <Select value={form.category || "laptop"} onValueChange={(v) => update("category", v)}>
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
              <Input
                id="location"
                value={form.location || ""}
                onChange={(e) => update("location", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="purchase_date">Purchase Date</Label>
              <Input
                id="purchase_date"
                type="date"
                value={form.purchase_date || ""}
                onChange={(e) => update("purchase_date", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="warranty_end_date">Warranty End Date</Label>
              <Input
                id="warranty_end_date"
                type="date"
                value={form.warranty_end_date || ""}
                onChange={(e) => update("warranty_end_date", e.target.value)}
              />
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
    </div>
  );
}
