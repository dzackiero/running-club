import { z } from "zod";

export const summaryQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export type SummaryQuery = z.infer<typeof summaryQuerySchema>;
