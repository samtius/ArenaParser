import type { ArenaMatch, ImportResponse, MatchDetails } from "../types";

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json() as Promise<T>;
}

export const fetchMatchSummaries = () => jsonRequest<ArenaMatch[]>("/api/matches/summaries");
export const fetchMatchDetails = (id: number) => jsonRequest<MatchDetails>(`/api/matches/${id}/details`);
export const importLatestArenaMatches = () => jsonRequest<ImportResponse>("/api/combat-log/import-arena-matches", { method: "POST" });
export async function reimportArenaMatches(): Promise<ImportResponse> {
  try { return await jsonRequest<ImportResponse>("/api/combat-log/reimport-all-arena-matches", { method: "POST" }); }
  catch (error) { if (error instanceof Error && error.message === "404") throw new Error("The backend is still running an older version. Restart ArenaParser, then try Reimport all logs again."); throw error; }
}
export async function shutdownApplication(): Promise<void> { const response = await fetch("/api/application/shutdown", { method: "POST" }); if (!response.ok) throw new Error(`${response.status}`); }
