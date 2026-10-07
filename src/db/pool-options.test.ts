import { describe, expect, it } from "vitest";

import { poolOptions } from "./pool-options";

describe("poolOptions (D11)", () => {
  it("uses a small per-instance pool without prepared statements in production", () => {
    expect(poolOptions("production")).toEqual({
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  });

  it("keeps the local pool at 10 with driver defaults otherwise", () => {
    expect(poolOptions("development")).toEqual({ max: 10 });
    expect(poolOptions("test")).toEqual({ max: 10 });
  });
});
