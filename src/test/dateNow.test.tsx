import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTodayDate } from "@/lib/dateNow";

function expectLocalDateParts(value: Date, year: number, monthIndex: number, day: number) {
  expect(value.getFullYear()).toBe(year);
  expect(value.getMonth()).toBe(monthIndex);
  expect(value.getDate()).toBe(day);
}

describe("useTodayDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the current local date on load", () => {
    vi.setSystemTime(new Date(2026, 2, 25, 9, 30, 0));

    const { result } = renderHook(() => useTodayDate());

    expectLocalDateParts(result.current, 2026, 2, 25);
  });

  it("updates at local midnight and continues updating daily", () => {
    vi.setSystemTime(new Date(2026, 2, 25, 23, 59, 55));

    const { result } = renderHook(() => useTodayDate());

    expectLocalDateParts(result.current, 2026, 2, 25);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expectLocalDateParts(result.current, 2026, 2, 26);

    act(() => {
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    });

    expectLocalDateParts(result.current, 2026, 2, 27);
  });
});
