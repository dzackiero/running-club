import { describe, expect, it } from "vitest";
import {
  createPlanTemplateSchema,
  todayDashboardSchema,
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

describe("todayDashboardSchema", () => {
  it("accepts a dated weekly dashboard with planned occurrences", () => {
    const dashboard = {
      date: "2026-08-18",
      items: [],
      week: {
        start: "2026-08-17",
        end: "2026-08-23",
        days: [
          {
            date: "2026-08-17",
            items: [
              {
                id: "occurrence-1",
                userId: "user-1",
                templateId: "template-1",
                date: "2026-08-17",
                category: "gym",
                title: "Lower body",
                details: { focus: "squat" },
                status: "planned",
                overriddenAt: null,
                completedAt: null,
                linkedRunId: null,
                linkedGymWorkoutId: null,
                createdAt: "2026-08-17T08:00:00.000Z",
                updatedAt: "2026-08-17T08:00:00.000Z",
              },
            ],
          },
        ],
        running: { distanceMeters: 0, completedSessions: 0, plannedSessions: 0 },
        gym: { completedSessions: 0, plannedSessions: 1 },
        nutrition: {
          targetDays: 0,
          achievedDays: 0,
          today: {
            calories: 0,
            proteinGrams: 0,
            targetCalories: null,
            targetProteinGrams: null,
          },
        },
      },
    };

    expect(todayDashboardSchema.safeParse(dashboard).success).toBe(true);
  });
});
