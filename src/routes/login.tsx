import { createFileRoute } from "@tanstack/react-router";
import { EditorAccess } from "@/components/review-workspace";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Editor sign-in" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Private editor access." },
    ],
  }),
  component: EditorAccess,
});
