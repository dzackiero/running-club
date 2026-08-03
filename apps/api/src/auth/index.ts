import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import { db } from "../db/client";
import * as schema from "../db/schema";
import { env } from "../env";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.WEB_ORIGIN],
  emailAndPassword: { enabled: true },
  plugins: [
    jwt(),
    oauthProvider({
      loginPage: `${env.WEB_ORIGIN}/sign-in`,
      consentPage: `${env.WEB_ORIGIN}/consent`,
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      silenceWarnings: {
        oauthAuthServerConfig: true,
      },
    }),
  ],
});
