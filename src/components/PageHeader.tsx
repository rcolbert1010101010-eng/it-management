import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function PageHeader({
  title,
  backTo,
  children,
}: {
  title: string;
  backTo?: string;
  children?: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {backTo && (
          <Button variant="ghost" size="icon" onClick={() => navigate(backTo)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
