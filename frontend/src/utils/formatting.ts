import type { CSSProperties } from "react";
import type { ArenaMatch, CompositionMember, MatchCategory } from "../types";

export function formatCcDuration(seconds: number): string { const rounded = Math.round(seconds * 10) / 10; return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}s`; }
export function resultLabel(match: ArenaMatch): string { return match.playerWins == null || match.playerLosses == null ? match.result : `${match.result} ${match.playerWins}-${match.playerLosses}`; }
export function belongsToCategory(match: ArenaMatch, category: MatchCategory): boolean { const type = (match.matchType ?? "").toLowerCase().replaceAll(" ", ""); if (category === "solo-shuffle") return type.includes("solo") || type.includes("shuffle"); if (category === "2v2") return type.includes("2v2") || type.includes("2x2"); if (category === "3v3") return type.includes("3v3") || type.includes("3x3"); return type.includes("skirmish"); }
export function formatDuration(totalSeconds: number): string { const roundedTotal = Math.max(0, Math.round(totalSeconds * 10) / 10); const minutes = Math.floor(roundedTotal / 60); const seconds = roundedTotal - minutes * 60; const secondsText = Number.isInteger(seconds) ? seconds.toFixed(0).padStart(2, "0") : seconds.toFixed(1).padStart(4, "0"); return `${minutes}:${secondsText}`; }
export function formatDate(value: string): string { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
export function formatNumber(value: number): string { return new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(value); }
export function compositionText(member: CompositionMember): string { return [member.specializationName, member.className].filter(Boolean).join(" "); }
export function matchesTerms(team: CompositionMember[], value: string): boolean { const haystacks = team.map((member) => `${member.name} ${member.className ?? ""} ${member.specializationName ?? ""}`.toLowerCase()); return value.toLowerCase().split(",").map((term) => term.trim()).filter(Boolean).every((term) => haystacks.some((member) => member.includes(term))); }
export function barStyle(value: number, maximum: number): CSSProperties { return { "--bar-width": `${maximum > 0 ? (value / maximum) * 60 : 0}%` } as CSSProperties; }
export function healthBarStyle(healthAfter: number, maxHealth: number): CSSProperties { const percentage = maxHealth > 0 ? Math.max(0, Math.min(100, (healthAfter / maxHealth) * 100)) : 0; return { "--bar-width": `${percentage}%` } as CSSProperties; }
