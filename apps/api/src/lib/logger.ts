import pino from "pino";
import { env } from "../env";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "running-club-api" },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "headers.authorization",
      "headers.cookie",
    ],
    remove: true,
  },
});

export type Logger = typeof logger;
