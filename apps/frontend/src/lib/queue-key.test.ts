import { describe, expect, it } from "vitest";
import { COMPOSITE_SEP, parseQueueKey, queueKey } from "./queue-key";

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
