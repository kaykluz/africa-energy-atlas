import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { getCookie } from "@tanstack/react-start/server";
import { ensureDbReady } from "@/lib/db";
import { envString } from "@/lib/env.server";
import { getRawDatabase } from "@/lib/sqlite.server";
import { magicLinkEmail, sendEmail } from "./email.server";
import { MAGIC_LINK_MINUTES } from "./providers";

/**
 * Better Auth for this app — **server-only**.
 *
 * Self-contained: sign-in runs against credentials this project owns. Google
 * OAuth uses a client in the site owner's own Google Cloud project, and email
 * sign-in sends a magic link through the site owner's Resend account. There is
 * no identity broker and no platform account in the path, so the workspace does
 * not follow the app from one host to another.
 *
 * Built LAZILY. On Cloudflare Workers secrets and the D1 binding only exist
 * inside a request, so a module-scope `betterAuth({...})` would capture an empty
 * environment on the first cold start. Call `getAuth()` from a handler instead.
 *
 * Configuration (Worker secrets / `.dev.vars`):
 *   BETTER_AUTH_SECRET     required — signs sessions
 *   BETTER_AUTH_URL        public origin, e.g. https://map.kaykluz.com
 *   GOOGLE_CLIENT_ID       \ Google sign-in; omit both to hide the button
 *   GOOGLE_CLIENT_SECRET   /
 *   RESEND_API_KEY         \ magic-link sign-in; omit either to hide the form
 *   EMAIL_FROM             /
 *   REVIEWER_EMAILS        the editor allowlist (see ../editor-allowlist.server)
 */

/** Session cookie name. `__Host-` forbids a `Domain` attribute, so no other
 *  host can write this app's session cookie. */
export const SESSION_TOKEN_COOKIE = "__Host-atlas-auth.session_token";

/** Local dev origins. Browsers may send any of these for the same server. */
const LOCAL_DEV_ORIGINS = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
];

export type AuthCapabilities = {
  /** Google sign-in is configured. */
  google: boolean;
  /** Resend magic-link sign-in is configured. */
  magicLink: boolean;
};

/** Which sign-in methods this deployment can actually offer. */
export async function authCapabilities(): Promise<AuthCapabilities> {
  return {
    google: Boolean(
      (await envString("GOOGLE_CLIENT_ID")) && (await envString("GOOGLE_CLIENT_SECRET")),
    ),
    magicLink: Boolean(
      (await envString("RESEND_API_KEY")) && (await envString("EMAIL_FROM")),
    ),
  };
}

/** True when at least one sign-in method is live. */
export async function authConfigured(): Promise<boolean> {
  const caps = await authCapabilities();
  return caps.google || caps.magicLink;
}

async function createAuth() {
  // Apply `migrations/*.sql` BEFORE Better Auth touches the database. It is
  // handed the raw D1 handle and does not migrate anything itself, so on a
  // cold, freshly created database the first sign-in would otherwise fail with
  // "no such table: verification".
  await ensureDbReady();
  const database = await getRawDatabase();
  const caps = await authCapabilities();

  const explicitBaseURL = await envString("BETTER_AUTH_URL");
  const secret = await envString("BETTER_AUTH_SECRET");

  if (!secret && explicitBaseURL) {
    // A deployment with a public URL but no signing secret would mint sessions
    // that any other instance could forge. Refuse rather than half-work.
    throw new Error(
      "BETTER_AUTH_SECRET is not set. Generate one (openssl rand -hex 32) and " +
        "add it with `wrangler secret put BETTER_AUTH_SECRET`.",
    );
  }

  const googleClientId = await envString("GOOGLE_CLIENT_ID");
  const googleClientSecret = await envString("GOOGLE_CLIENT_SECRET");

  return betterAuth({
    // A fixed origin when deployed; local dev falls back to the port-8080
    // contract so the OAuth redirect_uri matches what the browser sees.
    baseURL: explicitBaseURL ?? LOCAL_DEV_ORIGINS[0],
    // Dev-only fallback: a random secret would invalidate every session on each
    // reload, and the guard above makes this unreachable once deployed.
    secret: secret ?? "dev-only-insecure-secret-not-for-deployment",
    database,

    // Origins accepted on credentialed auth POSTs. A missing entry surfaces as
    // FORBIDDEN "Invalid origin".
    trustedOrigins: explicitBaseURL
      ? [explicitBaseURL, ...LOCAL_DEV_ORIGINS]
      : LOCAL_DEV_ORIGINS,

    // Email/password stays off for good: the workspace is allowlisted by email,
    // so a self-service password signup on an allowlisted address would be a
    // way in that bypasses the identity providers entirely.
    emailAndPassword: { enabled: false },

    ...(caps.google
      ? {
          socialProviders: {
            google: {
              clientId: googleClientId as string,
              clientSecret: googleClientSecret as string,
              // Always show the account chooser, so an editor signed into a
              // personal Google account can switch to the allowlisted one.
              prompt: "select_account" as const,
            },
          },
        }
      : {}),

    account: {
      encryptOAuthTokens: true,
      accountLinking: {
        // Google verifies its addresses, so linking a Google identity to an
        // existing magic-link user of the same address is safe and expected —
        // an editor should not end up with two accounts for one mailbox.
        enabled: true,
        trustedProviders: ["google", "magic-link"],
      },
    },

    // Cache the session in a short-lived signed cookie so reads skip the
    // database and the workspace does not flash a signed-out shell.
    session: { cookieCache: { enabled: true, maxAge: 300 } },

    advanced: {
      // Better Auth would otherwise apply a `__Secure-` prefix, which permits a
      // `Domain` attribute. `__Host-` does not, so the names are set here and
      // Secure is applied explicitly. Browsers allow Secure on http://localhost,
      // so local dev still works.
      useSecureCookies: false,
      defaultCookieAttributes: { secure: true, sameSite: "lax", path: "/" },
      cookies: {
        session_token: { name: SESSION_TOKEN_COOKIE },
        session_data: { name: "__Host-atlas-auth.session_data" },
        dont_remember: { name: "__Host-atlas-auth.dont_remember" },
      },
    },

    plugins: [
      magicLink({
        expiresIn: MAGIC_LINK_MINUTES * 60,
        // The allowlist is enforced again on every request, but refusing to
        // SEND to a non-editor matters on its own: it stops the sign-in form
        // being used as an open relay to mail arbitrary addresses. Returning
        // quietly (rather than erroring) keeps it from confirming who is on the
        // list.
        sendMagicLink: async ({ email, url }) => {
          const { isAllowedEditor } = await import("@/lib/editor-allowlist.server");
          if (!(await isAllowedEditor(email))) return;
          await sendEmail({ to: email, ...magicLinkEmail(url, MAGIC_LINK_MINUTES) });
        },
      }),

      // Bridges Better Auth's Set-Cookie into TanStack Start responses. MUST be
      // last so it runs after every other plugin's hooks.
      tanstackStartCookies(),
    ],
  });
}

/**
 * The instance type is INFERRED from `createAuth` rather than written as
 * `ReturnType<typeof betterAuth>`: Better Auth threads the concrete options
 * object through its generics, so the annotated form widens to
 * `Auth<BetterAuthOptions>` and stops assigning.
 */
type AuthInstance = Awaited<ReturnType<typeof createAuth>>;

const globalRef = globalThis as typeof globalThis & {
  __atlasAuth__?: Promise<AuthInstance>;
};

/**
 * The shared Better Auth instance, built on first use inside a request.
 * Memoized per isolate; a failed build is not memoized.
 */
export function getAuth(): Promise<AuthInstance> {
  globalRef.__atlasAuth__ ??= createAuth().catch((err) => {
    globalRef.__atlasAuth__ = undefined;
    throw err;
  });
  return globalRef.__atlasAuth__;
}

export function readSessionToken(): string | null {
  return getCookie(SESSION_TOKEN_COOKIE) ?? null;
}
