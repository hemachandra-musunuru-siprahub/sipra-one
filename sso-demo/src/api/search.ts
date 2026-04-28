import { api } from "./client";
import type { SearchResults } from "./types";

export const search = (q: string) =>
  api.get<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`);
