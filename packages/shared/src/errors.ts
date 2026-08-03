export const errorCodes = {
  UNAUTHORIZED: "UNAUTHORIZED",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "VALIDATION",
  CONFLICT: "CONFLICT",
} as const;

export type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes];
