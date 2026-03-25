import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  daysSinceLastLogin,
  daysUntilNetworkRemoval,
  getNetworkComplianceState,
} from "@/lib/assetLifecycle";

describe("asset lifecycle helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 25, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats today's login as healthy with 30 days until removal", () => {
    expect(daysSinceLastLogin("2026-03-25")).toBe(0);
    expect(daysUntilNetworkRemoval("2026-03-25")).toBe(30);
    expect(getNetworkComplianceState("2026-03-25")).toBe("healthy");
  });

  it("treats a 25 day old login as warning", () => {
    expect(daysSinceLastLogin("2026-02-28")).toBe(25);
    expect(daysUntilNetworkRemoval("2026-02-28")).toBe(5);
    expect(getNetworkComplianceState("2026-02-28")).toBe("warning");
  });

  it("treats a 30 day old login as overdue", () => {
    expect(daysSinceLastLogin("2026-02-23")).toBe(30);
    expect(daysUntilNetworkRemoval("2026-02-23")).toBe(0);
    expect(getNetworkComplianceState("2026-02-23")).toBe("overdue");
  });

  it("treats a missing login date as unknown", () => {
    expect(daysSinceLastLogin(null)).toBeNull();
    expect(daysUntilNetworkRemoval(null)).toBeNull();
    expect(getNetworkComplianceState(null)).toBe("unknown");
  });
});
