import { differenceInCalendarDays, isValid, parseISO, startOfToday } from "date-fns";

export const DEFAULT_NETWORK_REMOVAL_THRESHOLD_DAYS = 30;
const NETWORK_WARNING_WINDOW_DAYS = 5;

export type NetworkComplianceState = "healthy" | "warning" | "overdue" | "unknown";

function parseDateValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

export function daysSinceLastLogin(lastLoggedInDate: string | null | undefined) {
  const parsed = parseDateValue(lastLoggedInDate);
  if (!parsed) {
    return null;
  }

  return Math.max(0, differenceInCalendarDays(startOfToday(), parsed));
}

export function daysUntilNetworkRemoval(
  lastLoggedInDate: string | null | undefined,
  threshold = DEFAULT_NETWORK_REMOVAL_THRESHOLD_DAYS
) {
  const daysSince = daysSinceLastLogin(lastLoggedInDate);
  if (daysSince === null) {
    return null;
  }

  return threshold - daysSince;
}

export function getNetworkComplianceState(
  lastLoggedInDate: string | null | undefined,
  threshold = DEFAULT_NETWORK_REMOVAL_THRESHOLD_DAYS
): NetworkComplianceState {
  const daysSince = daysSinceLastLogin(lastLoggedInDate);
  if (daysSince === null) {
    return "unknown";
  }

  if (daysSince >= threshold) {
    return "overdue";
  }

  if (daysSince >= Math.max(0, threshold - NETWORK_WARNING_WINDOW_DAYS)) {
    return "warning";
  }

  return "healthy";
}

export function getNetworkComplianceLabel(state: NetworkComplianceState) {
  switch (state) {
    case "healthy":
      return "Healthy";
    case "warning":
      return "Warning";
    case "overdue":
      return "Needs Reimage";
    default:
      return "Unknown";
  }
}
