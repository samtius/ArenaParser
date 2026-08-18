import type { TimelineEvent } from "../../types";

export function SpellIcon({ spellId, name, size = 28, showTitle = true }: { spellId: number; name?: string | null; size?: number; showTitle?: boolean }) {
  const resolvedId = spellId > 0 ? spellId : 6603;
  return <img className="spell-icon" src={`https://images.wowarenalogs.com/spells/${resolvedId}.jpg`} width={size} height={size} loading="lazy" alt="" title={showTitle ? name ?? "Unknown spell" : undefined} onError={(event) => { event.currentTarget.src = "https://images.wowarenalogs.com/spells/6603.jpg"; }} />;
}

export function TimelineEventIcon({ event }: { event: TimelineEvent }) {
  return event.eventType === "UNIT_DIED"
    ? <span className="death-icon" aria-hidden="true">☠</span>
    : <SpellIcon spellId={event.spellId} name={event.spell} size={32} showTitle={false} />;
}

export function BattleNetIcon({ type, id, name, region, size = 38 }: { type: "item" | "spell"; id?: number; name?: string; region: string; size?: number }) {
  if (!id) return <span className="missing-game-icon" style={{ width: size, height: size }}>?</span>;
  return <img className="game-icon" src={`/api/media/${type}/${id}?region=${region}`} width={size} height={size} loading="lazy" alt="" title={name} />;
}
