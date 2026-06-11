import { describe, expect, it } from "vitest";
import {
  COMPOSITE_SEP,
  parseQueueKey,
  queueKey,
  queueNameFromParam,
  queueRouteParam,
  resolveQueueFromParam,
} from "./queue-key";

describe("queueKey / parseQueueKey", () => {
  it("joins prefix and name with the composite separator", () => {
    expect(queueKey("stage", "email")).toBe(`stage${COMPOSITE_SEP}email`);
    expect(queueKey("stage", "email")).toBe("stage::email");
  });

  it("parses a well-formed composite key back into prefix and name", () => {
    expect(parseQueueKey("stage::email")).toEqual({
      prefix: "stage",
      name: "email",
    });
  });

  it("returns null when the separator is missing", () => {
    expect(parseQueueKey("no-separator")).toBeNull();
    expect(parseQueueKey("")).toBeNull();
    expect(parseQueueKey(":single-colon")).toBeNull();
  });

  it("round-trips for a variety of prefix and name pairs", () => {
    const pairs: Array<[string, string]> = [
      ["bull", "email"],
      ["stage-1", "payment-processing"],
      ["a", "b"],
      ["prefix.with.dots", "queue_with_underscores"],
    ];
    for (const [prefix, name] of pairs) {
      expect(parseQueueKey(queueKey(prefix, name))).toEqual({ prefix, name });
    }
  });

  it("splits on the first separator so queue names may contain '::'", () => {
    const key = queueKey("a", "b::c");
    expect(key).toBe("a::b::c");
    expect(parseQueueKey(key)).toEqual({ prefix: "a", name: "b::c" });
  });

  it("allows an empty prefix or empty name", () => {
    expect(parseQueueKey(queueKey("", "name"))).toEqual({
      prefix: "",
      name: "name",
    });
    expect(parseQueueKey(queueKey("prefix", ""))).toEqual({
      prefix: "prefix",
      name: "",
    });
  });
});

describe("queueRouteParam", () => {
  it("builds a composite key from a queue's prefix and name", () => {
    expect(queueRouteParam({ prefix: "stage", name: "email" })).toBe(
      "stage::email",
    );
  });

  it("treats a missing prefix as empty", () => {
    expect(queueRouteParam({ name: "email" })).toBe("::email");
  });
});

describe("queueNameFromParam", () => {
  it("extracts the bare name from a composite param", () => {
    expect(queueNameFromParam("stage::email")).toBe("email");
  });

  it("returns a legacy name-only param unchanged", () => {
    expect(queueNameFromParam("email")).toBe("email");
  });
});

describe("resolveQueueFromParam", () => {
  const queues = [
    { name: "email", prefix: "bull" },
    { name: "email", prefix: "stage" },
    { name: "reports", prefix: "bull" },
  ];

  it("disambiguates queues that share a name across prefixes", () => {
    expect(resolveQueueFromParam("stage::email", queues)).toEqual({
      name: "email",
      prefix: "stage",
    });
    expect(resolveQueueFromParam("bull::email", queues)).toEqual({
      name: "email",
      prefix: "bull",
    });
  });

  it("falls back to a name-only match for legacy params", () => {
    expect(resolveQueueFromParam("reports", queues)).toEqual({
      name: "reports",
      prefix: "bull",
    });
  });

  it("falls back to a name match when the encoded prefix no longer exists", () => {
    expect(resolveQueueFromParam("gone::reports", queues)).toEqual({
      name: "reports",
      prefix: "bull",
    });
  });

  it("matches an empty-prefix queue via the composite key", () => {
    const withEmpty = [{ name: "email", prefix: "" }];
    expect(resolveQueueFromParam("::email", withEmpty)).toEqual({
      name: "email",
      prefix: "",
    });
  });

  it("returns undefined when queues are not yet loaded or nothing matches", () => {
    expect(resolveQueueFromParam("stage::email", undefined)).toBeUndefined();
    expect(resolveQueueFromParam("stage::missing", queues)).toBeUndefined();
  });
});
