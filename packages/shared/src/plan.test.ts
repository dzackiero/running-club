import { describe, expect, it } from "vitest";
import {
  createPlanTemplateSchema,
  updatePlanOccurrenceSchema,
} from "./plan";

describe("createPlanTemplateSchema", () => {
  it("accepts a run template with distance guidance", () => {
    const template = createPlanTemplateSchema.parse({
      weekday: 2,
      category: "run",
      title: "Easy 6 km",
      details: { targetDistanceMeters: 6000 },
    });

    expect(template).toMatchObject({
      weekday: 2,
      category: "run",
      title: "Easy 6 km",
      details: { targetDistanceMeters: 6000 },
    });
  });

  it("rejects weekday values outside the weekly range", () => {
    expect(() =>
      createPlanTemplateSchema.parse({
        weekday: 7,
        category: "run",
        title: "Easy 6 km",
        details: { targetDistanceMeters: 6000 },
      }),
    ).toThrow();
  });

  it("rejects details that do not match the selected category", () => {
    expect(() =>
      createPlanTemplateSchema.parse({
        weekday: 2,
        category: "gym",
        title: "Upper body",
        details: { targetDistanceMeters: 6000 },
      }),
    ).toThrow();
  });
});

describe("updatePlanOccurrenceSchema", () => {
  it.each(["planned", "done", "skipped"])(
    "accepts the %s occurrence status",
    (status) => {
      expect(updatePlanOccurrenceSchema.parse({ status })).toEqual({ status });
    },
  );

  it("rejects an unsupported occurrence status", () => {
    expect(() => updatePlanOccurrenceSchema.parse({ status: "cancelled" })).toThrow();
  });
});
