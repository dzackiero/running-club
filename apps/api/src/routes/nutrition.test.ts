import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app";
import { db } from "../db/client";
import { user } from "../db/schema";
import { inArray } from "drizzle-orm";

const stamp = Date.now();
const testPassword = "password123456";
const testName = "Nutrition Route Test";

async function signUpAndGetCookie(
  suffix: string,
): Promise<{ cookie: string; userId: string }> {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `nutrition-route-${stamp}-${suffix}@example.com`,
      password: testPassword,
      name: testName,
    }),
  });
  expect(response.status).toBe(200);
  const cookie = response.headers.get("set-cookie");
  expect(cookie).toBeTruthy();

  const me = await app.request("/api/me", { headers: { cookie: cookie! } });
  expect(me.status).toBe(200);
  return { cookie: cookie!, userId: (await me.json()).user.id };
}

describe("nutrition routes", () => {
  let owner: { cookie: string; userId: string };
  let other: { cookie: string; userId: string };
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    owner = await signUpAndGetCookie("owner");
    other = await signUpAndGetCookie("other");
    createdUserIds.push(owner.userId, other.userId);
  });

  afterAll(async () => {
    await db.delete(user).where(inArray(user.id, createdUserIds));
  });

  it("creates a draft and exposes it only to its owner", async () => {
    const create = await app.request("/nutrition/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({
        occurredAt: "2026-08-18T12:30:00.000Z",
        items: [
          {
            name: "Chicken rice",
            grams: 320,
            calories: 540,
            proteinGrams: 35,
            carbsGrams: 68,
            fatGrams: 14,
          },
        ],
      }),
    });
    expect(create.status).toBe(201);
    const draft = await create.json();
    expect(draft.status).toBe("draft");

    const ownerMeals = await app.request("/nutrition/meals?date=2026-08-18", {
      headers: { cookie: owner.cookie },
    });
    expect(ownerMeals.status).toBe(200);
    expect((await ownerMeals.json()).map((meal: { id: string }) => meal.id)).toContain(
      draft.id,
    );

    const otherMeals = await app.request("/nutrition/meals?date=2026-08-18", {
      headers: { cookie: other.cookie },
    });
    expect(otherMeals.status).toBe(200);
    expect((await otherMeals.json()).map((meal: { id: string }) => meal.id)).not.toContain(
      draft.id,
    );

    const otherConfirm = await app.request(`/nutrition/meals/${draft.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: other.cookie },
      body: JSON.stringify({}),
    });
    expect(otherConfirm.status).toBe(404);
  });

  it("confirms a draft and rejects confirmation after discard", async () => {
    const create = await app.request("/nutrition/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({
        occurredAt: "2026-08-19T12:30:00.000Z",
        items: [
          {
            name: "Tofu bowl",
            grams: 250,
            calories: 420,
            proteinGrams: 24,
            carbsGrams: 50,
            fatGrams: 14,
          },
        ],
      }),
    });
    const draft = await create.json();

    const confirmed = await app.request(`/nutrition/meals/${draft.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({}),
    });
    expect(confirmed.status).toBe(200);
    expect((await confirmed.json()).status).toBe("confirmed");

    const anotherCreate = await app.request("/nutrition/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({
        occurredAt: "2026-08-19T18:30:00.000Z",
        items: [
          {
            name: "Soup",
            grams: 300,
            calories: 200,
            proteinGrams: 12,
            carbsGrams: 20,
            fatGrams: 7,
          },
        ],
      }),
    });
    const discardedDraft = await anotherCreate.json();

    const discard = await app.request(`/nutrition/meals/${discardedDraft.id}/discard`, {
      method: "POST",
      headers: { cookie: owner.cookie },
    });
    expect(discard.status).toBe(200);
    expect((await discard.json()).status).toBe("discarded");

    const discardedConfirm = await app.request(
      `/nutrition/meals/${discardedDraft.id}/confirm`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: owner.cookie },
        body: JSON.stringify({}),
      },
    );
    expect(discardedConfirm.status).toBe(404);
  });

  it("updates a day's targets and returns confirmed-only progress", async () => {
    const put = await app.request("/nutrition/days/2026-08-19", {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ targetCalories: 2000, targetProteinGrams: 120 }),
    });
    expect(put.status).toBe(200);
    expect(await put.json()).toMatchObject({
      date: "2026-08-19",
      targetCalories: 2000,
      targetProteinGrams: 120,
    });

    const get = await app.request("/nutrition/days/2026-08-19", {
      headers: { cookie: owner.cookie },
    });
    expect(get.status).toBe(200);
    expect(await get.json()).toMatchObject({
      date: "2026-08-19",
      totals: { calories: 420, proteinGrams: 24 },
      targets: { calories: 2000, proteinGrams: 120 },
    });
  });
});
