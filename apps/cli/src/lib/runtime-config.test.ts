import { afterEach, describe, expect, it, vi } from "vitest";
import { getApiUrl, getAssetUrl, getBasePath } from "./runtime-config";

describe("runtime config", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds embedded API URLs from the credential-free browser origin", () => {
    vi.stubGlobal("window", {
      location: {
        origin: "http://localhost:3000",
      },
      __BULLSTUDIO__: {
        basePath: "/ops/bullstudio",
      },
    });

    expect(getBasePath()).toBe("/ops/bullstudio");
    expect(getApiUrl()).toBe(
      "http://localhost:3000/ops/bullstudio/api/trpc",
    );
  });

  it("keeps asset URLs path-relative so host-owned absolute assets still work", () => {
    vi.stubGlobal("window", {
      __BULLSTUDIO__: {
        basePath: "/ops/bullstudio",
      },
    });

    expect(getAssetUrl("/assets/app.css")).toBe(
      "/ops/bullstudio/assets/app.css",
    );
  });
});
