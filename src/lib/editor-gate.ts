import { createMiddleware } from "@tanstack/react-start";

/**
 * Dual client/server middlewares for the editor workspace.
 *
 * `optionalSessionMiddleware` forwards the live-preview bearer and resolves the
 * session without throwing — used to render the sign-in / not-allowlisted states.
 *
 * `editorMiddleware` is the chokepoint for every moderation mutation: same-site
 * request, verified session, then allowlist. The browser never decides who is
 * an editor.
 */

export const optionalSessionMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const user = await getSessionUser(context.bearerToken);
    return next({
      context: {
        userId: user?.id ?? null,
        email: user?.email ?? null,
      },
    });
  });

export const editorMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
    const { getSessionUser, UnauthorizedError } = await import("@/lib/auth/verify.server");
    const { ForbiddenError, isAllowedEditor } = await import("@/lib/editor-allowlist.server");
    assertSameSiteRequest();
    const user = await getSessionUser(context.bearerToken);
    if (!user) throw new UnauthorizedError();
    if (!isAllowedEditor(user.email)) throw new ForbiddenError();
    return next({
      context: {
        userId: user.id,
        email: user.email ?? "",
      },
    });
  });
