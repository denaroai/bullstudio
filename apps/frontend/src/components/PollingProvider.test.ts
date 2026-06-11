import { describe, expect, it } from "vitest";
import { DEFAULT_POLL_INTERVAL, resolvePolling } from "./PollingProvider";

describe("resolvePolling", () => {
  it("defaults to enabled at the default interval with overrides allowed", () => {
    expect(resolvePolling(undefined, null)).toEqual({
      enabled: true,
      interval: DEFAULT_POLL_INTERVAL,
      canOverride: true,
      minInterval: undefined,
    });
  });

  it("uses the operator's interval when no user preference is set", () => {
    expect(resolvePolling({ interval: 8000 }, null)).toMatchObject({
      enabled: true,
      interval: 8000,
    });
  });

  it("lets a user preference override the operator default", () => {
    expect(resolvePolling({ interval: 8000 }, 5000)).toMatchObject({
      enabled: true,
      interval: 5000,
    });
  });

  it('disables polling when the user picks "off"', () => {
    expect(resolvePolling(undefined, "off")).toMatchObject({
      enabled: false,
      canOverride: true,
    });
  });

  it("forces polling off and blocks override when the operator disables it", () => {
    expect(resolvePolling({ enabled: false }, 2000)).toMatchObject({
      enabled: false,
      canOverride: false,
    });
  });

  it("ignores the user preference when overrides are disallowed", () => {
    expect(
      resolvePolling({ interval: 9000, allowUserOverride: false }, 1000),
    ).toMatchObject({
      enabled: true,
      interval: 9000,
      canOverride: false,
    });
  });

  it("clamps a user preference up to the operator's minimum interval", () => {
    expect(resolvePolling({ minInterval: 5000 }, 2000)).toMatchObject({
      enabled: true,
      interval: 5000,
    });
  });

  it("clamps the operator default up to the minimum interval", () => {
    expect(
      resolvePolling({ interval: 1000, minInterval: 3000 }, null),
    ).toMatchObject({
      interval: 3000,
    });
  });
});
