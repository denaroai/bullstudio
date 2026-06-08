import { describe, expect, it } from "vitest";
import {
  type FlowDetailNavigationSource,
  getFlowDetailSearch,
} from "./flow-detail-navigation";

describe("getFlowDetailSearch", () => {
  it("uses private queue key when an embedded flow list item provides it", () => {
    expect(
      getFlowDetailSearch({
        queueName: "email",
        prefix: "bull",
        queueKey: "email-primary",
      } satisfies FlowDetailNavigationSource),
    ).toEqual({
      queueKey: "email-primary",
      queueName: "email",
      prefix: "bull",
    });
  });

  it("preserves standalone queue name and prefix navigation when queue key is absent", () => {
    expect(
      getFlowDetailSearch({
        queueName: "email",
        prefix: "bull",
      } satisfies FlowDetailNavigationSource),
    ).toEqual({
      queueName: "email",
      prefix: "bull",
    });
  });
});
