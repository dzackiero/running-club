import { z } from "zod";

export const updatePreferencesSchema = z.object({
  emailNotifications: z.boolean(),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

export type PreferencesRecord = {
  emailNotifications: boolean;
};
