import { describe, expect, it, vi } from "vitest";
import { pollAllIntervalsImports } from "./intervals-poll";

describe("pollAllIntervalsImports", () => {
  it("imports each connected user and continues after a failure", async () => {
    const importUser = vi
      .fn()
      .mockResolvedValueOnce({ imported: 1, updated: 0, skipped: 0 })
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ imported: 0, updated: 2, skipped: 1 });

    const result = await pollAllIntervalsImports({
      listCredentials: async () => [
        { userId: "u1", apiKey: "k1" },
        { userId: "u2", apiKey: "k2" },
        { userId: "u3", apiKey: "k3" },
      ],
      importUser,
    });

    expect(importUser).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ users: 3, failures: 1 });
  });
});
