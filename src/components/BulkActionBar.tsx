import { Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BulkActionBarProps = {
  entityLabel: string;
  selectedCount: number;
  onBulkEdit: () => void;
  onDelete: () => void;
  onClear: () => void;
  isPending?: boolean;
};

export function BulkActionBar({
  entityLabel,
  selectedCount,
  onBulkEdit,
  onDelete,
  onClear,
  isPending = false,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
      <p className="text-sm font-medium">
        {selectedCount} {entityLabel}
        {selectedCount === 1 ? "" : "s"} selected
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onBulkEdit} disabled={isPending}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Bulk Edit
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={isPending}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete Selected
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={isPending}>
          <X className="mr-1.5 h-3.5 w-3.5" />
          Clear Selection
        </Button>
      </div>
    </div>
  );
}
