import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmBulkDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityLabel: string;
  count: number;
  onConfirm: () => void;
  isPending?: boolean;
};

export function ConfirmBulkDeleteDialog({
  open,
  onOpenChange,
  entityLabel,
  count,
  onConfirm,
  isPending = false,
}: ConfirmBulkDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete selected {entityLabel}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete {count} selected {entityLabel}
            {count === 1 ? "" : "s"}. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {isPending ? "Deleting..." : `Delete ${count}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
