import { envString } from "@/lib/env.server";

/**
 * Transactional email via Resend — **server-only**.
 *
 * Called over plain `fetch` rather than the `resend` SDK: one HTTPS POST is the
 * whole integration, and the SDK pulls Node built-ins that cost bundle size on
 * a Worker for no gain.
 *
 * Configuration (Worker secrets / `.dev.vars`):
 *   RESEND_API_KEY   required to send at all
 *   EMAIL_FROM       e.g. "Africa Energy Atlas <atlas@kaykluz.com>"
 *                    the domain must be verified in Resend
 */

export class EmailNotConfiguredError extends Error {
  readonly status = 503;
  constructor() {
    super(
      "Email sign-in is not configured on this deployment (RESEND_API_KEY / EMAIL_FROM).",
    );
    this.name = "EmailNotConfiguredError";
  }
}

/** True when this deployment can actually send mail. */
export async function emailConfigured(): Promise<boolean> {
  return Boolean((await envString("RESEND_API_KEY")) && (await envString("EMAIL_FROM")));
}

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/**
 * Send one email. Throws `EmailNotConfiguredError` when the deployment has no
 * Resend credentials, and a plain `Error` carrying Resend's message when the
 * API rejects the send — Better Auth surfaces that to the caller, so a typo in
 * the from-address shows up as a real error rather than a silent no-op.
 */
export async function sendEmail(message: OutboundEmail): Promise<void> {
  const apiKey = await envString("RESEND_API_KEY");
  const from = await envString("EMAIL_FROM");
  if (!apiKey || !from) throw new EmailNotConfiguredError();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Resend rejected the message (${response.status}): ${detail.slice(0, 400)}`,
    );
  }
}

/** Escape a value for interpolation into the HTML body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The editor sign-in link.
 *
 * Deliberately plain: no tracking pixel, no remote images, no marketing chrome.
 * The link is a single-use credential, so the copy says so and states how long
 * it lasts.
 */
export function magicLinkEmail(url: string, minutes: number): Omit<OutboundEmail, "to"> {
  const safeUrl = escapeHtml(url);
  return {
    subject: "Your Africa Energy Atlas editor sign-in link",
    text: [
      "Sign in to the Africa Energy Atlas editor workspace:",
      "",
      url,
      "",
      `This link works once and expires in ${minutes} minutes.`,
      "If you did not ask to sign in, ignore this message — nothing happens until the link is opened.",
    ].join("\n"),
    html: [
      '<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6;color:#111">',
      "<p>Sign in to the Africa Energy Atlas editor workspace:</p>",
      `<p><a href="${safeUrl}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;border-radius:8px;text-decoration:none">Open the workspace</a></p>`,
      `<p style="font-size:13px;color:#555">This link works once and expires in ${minutes} minutes.</p>`,
      '<p style="font-size:13px;color:#555">If you did not ask to sign in, ignore this message — nothing happens until the link is opened.</p>',
      `<p style="font-size:12px;color:#777;word-break:break-all">${safeUrl}</p>`,
      "</div>",
    ].join(""),
  };
}
