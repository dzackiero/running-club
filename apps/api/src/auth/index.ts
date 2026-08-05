import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import { db } from "../db/client";
import * as schema from "../db/schema";
import { env } from "../env";
import { googleSocialProviders } from "./social";

/** OAuth/OIDC issuer — must match access-token `iss` and discovery metadata. */
const authIssuer = `${env.BETTER_AUTH_URL}/api/auth`;
const socialProviders = googleSocialProviders(env);

export const auth = betterAuth({
  appName: "CUP Run",
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.WEB_ORIGIN],
  // `/token` conflicts with OAuth `/oauth2/token` when using the JWT plugin as AS
  disabledPaths: ["/token"],
  emailAndPassword: { enabled: true },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      // Email/password signup does not verify email. Without this, Google
      // sign-in for the same address fails with account_not_linked.
      requireLocalEmailVerified: false,
    },
  },
  ...(socialProviders ? { socialProviders } : {}),
  plugins: [
    jwt({
      disableSettingJwtHeader: true,
      jwt: {
        issuer: authIssuer,
      },
    }),
    oauthProvider({
      loginPage: `${env.WEB_ORIGIN}/sign-in`,
      consentPage: `${env.WEB_ORIGIN}/consent`,
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      // MCP resource identifier — clients request this as `resource` / JWT `aud`
      validAudiences: [`${env.API_PUBLIC_URL}/mcp`],
      silenceWarnings: {
        oauthAuthServerConfig: true,
      },
    }),
  ],
});
