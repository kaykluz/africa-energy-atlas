import { createServerFn } from "@tanstack/react-start";

/**
 * Which sign-in methods this deployment can actually offer.
 *
 * Read from the server because it depends on which secrets are present in the
 * Worker environment — the browser has no way to know, and must not be told
 * anything beyond "this button will work".
 */
export type SignInMethods = {
  google: boolean;
  magicLink: boolean;
};

export const getSignInMethods = createServerFn({ method: "GET" }).handler(
  async (): Promise<SignInMethods> => {
    const { authCapabilities } = await import("@/lib/auth/server");
    return authCapabilities();
  },
);
