import { Badge } from "@/components/ui/badge";
import {
  getNetworkComplianceState,
  getNetworkComplianceLabel,
  type NetworkComplianceState,
} from "@/lib/assetLifecycle";
import { cn } from "@/lib/utils";

const lifecycleColors: Record<NetworkComplianceState, string> = {
  healthy: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  warning: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
  overdue: "border-transparent bg-red-500/15 text-red-700 dark:text-red-400",
  unknown: "border-transparent bg-slate-500/15 text-slate-700 dark:text-slate-400",
};

type AssetLifecycleBadgeProps =
  | {
      state: NetworkComplianceState;
      lastLoggedInDate?: never;
      today?: never;
    }
  | {
      state?: never;
      lastLoggedInDate: string | null | undefined;
      today?: Date;
    };

export function AssetLifecycleBadge(props: AssetLifecycleBadgeProps) {
  const state =
    props.state ?? getNetworkComplianceState(props.lastLoggedInDate, props.today);

  return <Badge className={cn(lifecycleColors[state])}>{getNetworkComplianceLabel(state)}</Badge>;
}
