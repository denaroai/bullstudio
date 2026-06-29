import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPrefixes } from "./prefixes";

describe("getPrefixes", () => {
  const original = process.env.REDIS_PREFIX;

  beforeEach(() => {
    delete process.env.REDIS_PREFIX;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.REDIS_PREFIX;
    } else {
      process.env.REDIS_PREFIX = original;
    }
  });

  it("defaults to the auto-discovery wildcard when unset", () => {
    expect(getPrefixes()).toEqual(["*"]);
  });

  it("treats an empty string as unset and returns the wildcard", () => {
    process.env.REDIS_PREFIX = "";
    expect(getPrefixes()).toEqual(["*"]);
  });

  it("returns a single-element array for a single prefix", () => {
    process.env.REDIS_PREFIX = "stage";
    expect(getPrefixes()).toEqual(["stage"]);
  });

  it("splits comma-separated prefixes and trims whitespace", () => {
    process.env.REDIS_PREFIX = "stage, prod , ";
    expect(getPrefixes()).toEqual(["stage", "prod"]);
  });

  it("preserves an explicit wildcard", () => {
    process.env.REDIS_PREFIX = "*";
    expect(getPrefixes()).toEqual(["*"]);
  });

  it("filters out empty segments between commas", () => {
    process.env.REDIS_PREFIX = "a,,b";
    expect(getPrefixes()).toEqual(["a", "b"]);
  });
});
