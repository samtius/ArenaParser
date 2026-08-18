import type { TrackedCharacter } from "../types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json() as Promise<T>;
}

export async function fetchCharacters(): Promise<{ characters: TrackedCharacter[]; battleNetConfigured: boolean }> {
  const [profiles, status] = await Promise.all([
    request<TrackedCharacter[]>("/api/characters"),
    request<{ battleNetConfigured: boolean }>("/api/characters/status"),
  ]);
  return { characters: profiles, battleNetConfigured: status.battleNetConfigured };
}
export const addTrackedCharacter = (name: string, realm: string, region: string) => request<TrackedCharacter>("/api/characters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, realm, region }) });
export const refreshTrackedCharacter = (id: number) => request<TrackedCharacter>(`/api/characters/${id}/refresh`, { method: "POST" });
export async function removeTrackedCharacter(id: number): Promise<void> { const response = await fetch(`/api/characters/${id}`, { method: "DELETE" }); if (!response.ok) throw new Error(`${response.status}`); }
