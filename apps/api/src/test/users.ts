import { inArray } from "drizzle-orm";
import { db } from "../db/client";
import { user } from "../db/schema";

/** Ensure Better Auth `user` rows exist so FK-constrained run/goal inserts succeed. */
export async function ensureTestUsers(ids: string[]) {
  for (const id of ids) {
    await db
      .insert(user)
      .values({
        id,
        name: `Test ${id}`,
        email: `${id}@test.local`,
        emailVerified: false,
      })
      .onConflictDoNothing();
  }
}

export async function deleteTestUsers(ids: string[]) {
  if (ids.length === 0) return;
  await db.delete(user).where(inArray(user.id, ids));
}
