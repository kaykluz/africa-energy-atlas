/**
 * The sign-in methods this app offers.
 *
 * Source of truth for BOTH the server (`server.ts`) and the client
 * (`client.ts` / the sign-in form). Kept dependency-free so the client can
 * import it without pulling the server-only Better Auth instance in with it.
 *
 * Every method here runs against credentials THIS project owns — a Google OAuth
 * client in the site owner's Google Cloud project, and a Resend API key on the
 * site owner's domain. There is no third-party identity broker in the path.
 */

export type SocialProvider = {
  /** Better Auth's social provider id; also the callback path segment. */
  providerId: "google";
  /** Human label for the sign-in button. */
  label: string;
};

export const SOCIAL_PROVIDERS: readonly SocialProvider[] = [
  { providerId: "google", label: "Google" },
];

/** How long a magic link stays valid. Mirrored in the email copy. */
export const MAGIC_LINK_MINUTES = 15;
