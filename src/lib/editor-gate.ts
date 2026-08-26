import { createMiddleware } from "@tanstack/react-start";

/**
 * Middlewares for the editor workspace.
 *
 * `optionalSessionMiddleware` resolves the session without throwing — used to
 * render the sign-in and not-allowlisted states.
 *
 * `editorMiddleware` is the chokepoint for every moderation mutation: same-site
 * request, verified session, then allowlist. The browser never decides who is
 * an editor; it only decides what to draw.
 *
 * The session is a first-party cookie on this app's own origin, so it rides
 * along with server-function calls automatically — nothing to forward by hand.
 */

export const optionalSessionMiddleware = createMiddleware({ type: "function" })
  .server(async ({ next }) => {
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const user = await getSessionUser();
    return next({
      context: {
        userId: user?.id ?? null,
        email: user?.email ?? null,
      },
    });
  });

export const editorMiddleware = createMiddleware({ type: "function" })
  .server(async ({ next }) => {
    const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
    const { getSessionUser, UnauthorizedError } = await import("@/lib/auth/verify.server");
    const { ForbiddenError, isAllowedEditor } = await import("@/lib/editor-allowlist.server");
    assertSameSiteRequest();
    const user = await getSessionUser();
    if (!user) throw new UnauthorizedError();
    if (!(await isAllowedEditor(user.email))) throw new ForbiddenError();
    return next({
      context: {
        userId: user.id,
        email: user.email ?? "",
      },
    });
  });
