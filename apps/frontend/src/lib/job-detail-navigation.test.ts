import { describe, expect, it } from "vitest";
import {
  getJobDetailSearch,
  type JobDetailNavigationSource,
} from "./job-detail-navigation";

describe("getJobDetailSearch", () => {
  it("uses private queue key when an embedded job list item provides it", () => {
    expect(
      getJobDetailSearch({
        queueName: "email",
        prefix: "bull",
        queueKey: "email-primary",
      } satisfies JobDetailNavigationSource),
    ).toEqual({
      queueKey: "email-primary",
      queueName: "email",
      prefix: "bull",
    });
  });

  it("preserves standalone queue name and prefix navigation when queue key is absent", () => {
    expect(
      getJobDetailSearch({
        queueName: "email",
        prefix: "bull",
      } satisfies JobDetailNavigationSource),
    ).toEqual({
      queueName: "email",
      prefix: "bull",
    });
  });
});
