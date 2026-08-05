import type {
  PreferencesRecord,
  UpdatePreferencesInput,
} from "@running-club/shared";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { user } from "../db/schema";

export async function getPreferences(
  userId: string,
): Promise<PreferencesRecord> {
  const [row] = await db
    .select({ emailNotifications: user.emailNotifications })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return { emailNotifications: row?.emailNotifications ?? true };
}

export async function updatePreferences(
  userId: string,
  input: UpdatePreferencesInput,
): Promise<PreferencesRecord> {
  const [row] = await db
    .update(user)
    .set({ emailNotifications: input.emailNotifications })
    .where(eq(user.id, userId))
    .returning({ emailNotifications: user.emailNotifications });
  return { emailNotifications: row?.emailNotifications ?? input.emailNotifications };
}
