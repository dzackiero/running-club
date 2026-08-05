import { Resend } from "resend";
import { env } from "../env";
import { logger } from "./logger";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    logger.warn("Resend is not configured; skipping email");
    return false;
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
  if (result.error) {
    logger.error({ err: result.error, to: input.to }, "Resend send failed");
    return false;
  }
  return true;
}
