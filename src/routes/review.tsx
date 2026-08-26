import { createFileRoute } from "@tanstack/react-router";
import { EditorAccess } from "@/components/review-workspace";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Editor workspace" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Private editorial workspace." },
    ],
  }),
  component: EditorAccess,
});
