import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  WEB_ORIGIN: z.string().url(),
  API_PUBLIC_URL: z.string().url(),
  PORT: z.coerce.number().default(8787),
});

export const env = envSchema.parse(process.env);
