import { createFileRoute } from "@tanstack/react-router";
import { parseAtlasSearch } from "@/lib/atlas-search";
import { AtlasPage } from "@/components/atlas";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>) => parseAtlasSearch(s),
  component: AtlasPage,
});
