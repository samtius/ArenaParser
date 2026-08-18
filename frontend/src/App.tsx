import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";

type MatchResult = "WIN" | "LOSS" | "DRAW" | "UNKNOWN";

interface ArenaMatch {
  id: number;
  arena: string;
  startedAt: string;
  durationSeconds: number;
  instanceId: number | null;
  matchType: string | null;
  playerTeam: number | null;
  winningTeam: number | null;
  result: MatchResult;
  playerWins: number | null;
  playerLosses: number | null;
  playerMmr: number | null;
  opponentMmr: number | null;
  yourTeam: CompositionMember[];
  opponentTeam: CompositionMember[];
}

interface CompositionMember { name: string; className: string | null; specializationName: string | null; }

interface ImportResponse {
  detectedMatches: number;
  importedMatches: number;
  skippedMatches: number;
}

interface TrackedCharacter {
  id: number; name: string; realmSlug: string; region: string; characterClass: string | null;
  activeSpecialization: string | null; level: number | null; itemLevel: number | null;
  achievementPoints: number | null; avatarUrl: string | null; lastSyncedAt: string | null; syncError: string | null;
  equipment?: CharacterEquipment | null; specializations?: CharacterSpecializations | null;
}

interface EquipmentItem {
  item?: { id: number }; media?: { id: number }; slot?: { type: string; name: string }; name?: string; quality?: { type: string; name: string };
  level?: { value: number; display_string: string }; stats?: Array<{ type?: { name: string }; value?: number; display?: { display_string: string } }>;
  enchantments?: Array<{ display_string?: string; enchantment_id?: number }>;
  sockets?: Array<{ socket_type?: { name: string }; item?: { id: number; name: string }; display_string?: string }>;
  set?: { item_set?: { name?: string } };
}
interface CharacterEquipment { equipped_items?: EquipmentItem[]; }
interface TalentChoice { id?: number; rank?: number; tooltip?: { talent?: { name?: string; id?: number }; spell_tooltip?: { spell?: { name?: string; id?: number }; description?: string } }; }
interface PvpTalentSlot { slot_number?: number; selected?: { talent?: { name?: string; id?: number }; spell_tooltip?: { spell?: { name?: string; id?: number }; description?: string } }; }
interface TalentLoadout {
  is_active?: boolean; talent_loadout_code?: string;
  selected_class_talents?: TalentChoice[]; selected_spec_talents?: TalentChoice[]; selected_hero_talents?: TalentChoice[];
  selected_class_talent_tree?: { name?: string; key?: { href?: string } }; selected_spec_talent_tree?: { name?: string; key?: { href?: string } };
  selected_hero_talent_tree?: { name?: string; id?: number };
}
interface SpecializationLoadout { specialization?: { name?: string; id?: number }; pvp_talent_slots?: PvpTalentSlot[]; loadouts?: TalentLoadout[]; }
interface CharacterSpecializations { specializations?: SpecializationLoadout[]; active_specialization?: { name?: string }; active_hero_talent_tree?: { name?: string }; }
interface TreeRank { rank?: number; tooltip?: { talent?: { name?: string }; spell_tooltip?: { spell?: { id?: number; name?: string }; description?: string } }; }
interface TreeNode { id: number; unlocks?: number[]; locked_by?: number[]; node_type?: { type?: string }; ranks?: TreeRank[]; display_row?: number; display_col?: number; raw_position_x?: number; raw_position_y?: number; }
interface HeroTree { id: number; name: string; hero_talent_nodes?: TreeNode[]; }
interface TalentTreeData { name?: string; class_talent_nodes?: TreeNode[]; spec_talent_nodes?: TreeNode[]; hero_talent_trees?: HeroTree[]; }

interface SpellStatistic {
  spellId: number; name: string; damage: number; healing: number; absorbs: number; damageTaken: number;
  casts: number; hits: number; criticals: number; overhealing: number;
}

interface UtilityAction { offsetSeconds: number; spellId: number; spell: string | null; target: string | null; affectedSpellId: number; affectedSpell: string | null; }
interface ReceivedEvent { secondsBeforeDeath: number; type: "DAMAGE" | "HEALING"; source: string | null; spellId: number; spell: string | null; amount: number; healthAfter: number; maxHealth: number; }
interface DeathRecap { deathNumber: number; offsetSeconds: number; receivedEvents: ReceivedEvent[]; }

interface ParticipantDetails {
  guid: string; name: string; className: string; specializationName: string; team: number | null; damage: number; healing: number;
  absorbs: number; kills: number; deaths: number; interrupts: number; dispels: number;
  damageTaken: number; spells: SpellStatistic[]; interruptDetails: UtilityAction[];
  dispelDetails: UtilityAction[]; deathRecaps: DeathRecap[];
}

interface KeyEvent {
  offsetSeconds: number; type: string; source: string | null; target: string | null; spell: string | null;
}

interface TimelineEvent { offsetSeconds: number; spellId: number; spell: string; category: "DEFENSIVE" | "OFFENSIVE" | "CROWD_CONTROL" | "DEATH"; source: string; team: number | null; target: string | null; eventType: string; }
interface CcInterval { start: number; end: number; spellId: number; spell: string; source: string; exactDuration: boolean; lane: number; drCategory: string; previousDrEnd: number | null; previousDrSpell: string | null; previousDrSpellId: number | null; drGap: number | null; }
interface CcChain { start: number; end: number; totalDuration: number; exactDuration: boolean; trinket: TimelineEvent | null; }
interface DefensiveOverlap { target: string; first: string; firstSpellId: number; second: string; secondSpellId: number; start: number; end: number; }
interface DrOverlap { target: ParticipantDetails; first: string; firstSpellId: number; second: string; secondSpellId: number; category: string; start: number; end: number; gap: number; immune: boolean; }
interface RoundDetails { roundNumber: number; durationSeconds: number; playerTeam: number | null; winningTeam: number | null; result: MatchResult; participants: ParticipantDetails[]; timeline: TimelineEvent[]; }
interface MatchDetails { participants: ParticipantDetails[]; keyEvents: KeyEvent[]; rounds: RoundDetails[]; timeline: TimelineEvent[]; }

const healerSpecializations = new Set(["Discipline", "Holy", "Restoration", "Mistweaver", "Preservation"]);

function isAllowedDefensiveCombination(firstSpell: string, secondSpell: string): boolean {
  const spells = new Set([firstSpell.toLowerCase().trim(), secondSpell.toLowerCase().trim()]);
  return spells.size === 2 && spells.has("phase shift") && spells.has("fade");
}

function isIgnoredDefensiveOverlapSpell(spell: string, spellId: number): boolean {
  const name = spell.toLowerCase().trim();
  return name.includes("phase shift")
    || name === "fade"
    || name.includes("frenzied regeneration")
    || name.includes("sanctified ground")
    || name.includes("precognition")
    || name.includes("spirit of redemption")
    || name.includes("gladiator's medallion")
    || name.includes("pvp trinket")
    || name === "trinket"
    || spellId === 336126
    || spellId === 208683
    || spellId === 42292;
}

function timelineEventTeam(event: TimelineEvent, participants: ParticipantDetails[]): number | null {
  return participants.find((participant) => participant.name === event.source)?.team ?? event.team;
}

function timelineTargetLabel(event: TimelineEvent, participants: ParticipantDetails[]): string {
  const target = event.target == null ? null : participants.find((participant) => participant.name === event.target);
  if (target == null) return event.target ?? event.source;
  if (healerSpecializations.has(target.specializationName)) return "healer";
  return (target.className ?? target.name).toLowerCase();
}

function timelineTargetsLabel(event: TimelineEvent, relatedEvents: TimelineEvent[], participants: ParticipantDetails[]): string {
  const labels = relatedEvents
    .filter((candidate) =>
      candidate.spellId === event.spellId &&
      candidate.source === event.source &&
      candidate.target != null &&
      Math.abs(candidate.offsetSeconds - event.offsetSeconds) < 0.5
    )
    .map((candidate) => timelineTargetLabel(candidate, participants));
  if (labels.length === 0) return timelineTargetLabel(event, participants);

  const counts = new Map<string, number>();
  labels.forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1));
  return Array.from(counts, ([label, count]) => count > 1 ? `${label} ×${count}` : label).join(", ");
}

function deduplicateTimelineEvents(events: TimelineEvent[]): TimelineEvent[] {
  const groups: TimelineEvent[][] = [];
  events.forEach((event) => {
    const group = groups.find((candidates) => {
      const previous = candidates[0];
      return previous.source === event.source &&
        previous.spell.toLowerCase() === event.spell.toLowerCase() &&
        Math.abs(previous.offsetSeconds - event.offsetSeconds) < 0.5;
    });
    if (group) group.push(event); else groups.push([event]);
  });
  return groups.map((group) => group.find((event) => event.eventType === "SPELL_CAST_SUCCESS") ?? group[0]);
}

function timelineWithStoredDeaths(events: TimelineEvent[], participants: ParticipantDetails[]): TimelineEvent[] {
  const combined = [...events];
  participants.forEach((player) => (player.deathRecaps ?? []).forEach((recap) => {
    const alreadyIncluded = combined.some((event) =>
      event.eventType === "UNIT_DIED" && event.target === player.name && event.offsetSeconds === recap.offsetSeconds
    );
    if (!alreadyIncluded) combined.push({
      offsetSeconds: recap.offsetSeconds,
      spellId: 0,
      spell: "Died",
      category: "DEATH",
      source: player.name,
      team: player.team,
      target: player.name,
      eventType: "UNIT_DIED"
    });
  }));
  return combined.sort((first, second) => first.offsetSeconds - second.offsetSeconds);
}

function timelineStackIndex(events: TimelineEvent[], eventIndex: number, sideFor: (event: TimelineEvent) => number, collisionWindowSeconds: number): number {
  const event = events[eventIndex];
  const side = sideFor(event);
  return events.slice(0, eventIndex).filter((candidate) =>
    sideFor(candidate) === side && Math.abs(candidate.offsetSeconds - event.offsetSeconds) <= collisionWindowSeconds
  ).length % 3;
}

function timelineEventStyle(left: string, stackIndex: number): CSSProperties {
  return { left, "--timeline-stack-offset": `${stackIndex * 17}px` } as CSSProperties;
}

function drCategory(spell: string): string {
  const name = spell.toLowerCase();
  if (["kidney shot", "cheap shot", "hammer of justice", "leg sweep", "maim", "mighty bash", "storm bolt", "asphyxiate", "shadowfury", "axe toss"].some((value) => name.includes(value))) return "Stun";
  if (["cyclone", "fear", "psychic scream", "howl of terror", "intimidating shout"].some((value) => name.includes(value))) return "Disorient";
  if (["polymorph", "sap", "repentance", "paralysis", "freezing trap", "hex", "imprison", "gouge", "mortal coil"].some((value) => name.includes(value))) return "Incapacitate";
  if (["frost nova", "entangling roots", "mass entanglement"].some((value) => name.includes(value))) return "Root";
  if (["silence", "garrote"].some((value) => name.includes(value))) return "Silence";
  return spell;
}

function defensiveOwner(event: TimelineEvent): string | null {
  // Touch of Karma applies a harmful aura to the opponent, but the defensive
  // cooldown protects the monk who cast it.
  if (event.spell.toLowerCase().includes("touch of karma")) return event.source || null;
  return event.target;
}

function defensiveOverlaps(events: TimelineEvent[]): DefensiveOverlap[] {
  const applications = events.filter((event) => event.category === "DEFENSIVE" && event.eventType === "SPELL_AURA_APPLIED" && defensiveOwner(event));
  const removals = events.filter((event) => event.category === "DEFENSIVE" && event.eventType === "SPELL_AURA_REMOVED" && defensiveOwner(event));
  const usedRemovals = new Set<number>();
  const intervals = applications.flatMap((event) => {
    const owner = defensiveOwner(event);
    const removalIndex = removals.findIndex((removal, index) => !usedRemovals.has(index) && defensiveOwner(removal) === owner && removal.offsetSeconds >= event.offsetSeconds && (removal.spellId === event.spellId || removal.spell === event.spell));
    if (removalIndex < 0) return [];
    usedRemovals.add(removalIndex);
    return [{ target: owner!, spell: event.spell, spellId: event.spellId, start: event.offsetSeconds, end: removals[removalIndex].offsetSeconds }];
  });
  const overlaps: DefensiveOverlap[] = [];
  intervals.forEach((first, index) => intervals.slice(index + 1).forEach((second) => {
    const start = Math.max(first.start, second.start); const end = Math.min(first.end, second.end);
    if (first.target === second.target && first.spell !== second.spell && start < end
      && !isIgnoredDefensiveOverlapSpell(first.spell, first.spellId)
      && !isIgnoredDefensiveOverlapSpell(second.spell, second.spellId)
      && !isAllowedDefensiveCombination(first.spell, second.spell))
      overlaps.push({ target: first.target, first: first.spell, firstSpellId: first.spellId, second: second.spell, secondSpellId: second.spellId, start, end });
  }));
  return overlaps;
}

function healerCcIntervals(healer: ParticipantDetails, events: TimelineEvent[], duration: number): CcInterval[] {
  const removals = events.filter((event) => event.category === "CROWD_CONTROL" && event.eventType === "SPELL_AURA_REMOVED" && event.target === healer.name);
  const usedRemovals = new Set<number>();
  const intervals = events
    .filter((event) => event.category === "CROWD_CONTROL" && event.eventType === "SPELL_AURA_APPLIED" && event.target === healer.name)
    .map((event): CcInterval => {
      const removalIndex = removals.findIndex((removal, index) => !usedRemovals.has(index) && removal.offsetSeconds >= event.offsetSeconds && (removal.spellId === event.spellId || removal.spell === event.spell));
      if (removalIndex >= 0) usedRemovals.add(removalIndex);
      const exactDuration = removalIndex >= 0;
      return { start: event.offsetSeconds, end: exactDuration ? removals[removalIndex].offsetSeconds : Math.min(duration, event.offsetSeconds + 1), spellId: event.spellId, spell: event.spell, source: event.source, exactDuration, lane: 0, drCategory: drCategory(event.spell), previousDrEnd: null, previousDrSpell: null, previousDrSpellId: null, drGap: null };
    })
    .sort((first, second) => first.start - second.start || first.end - second.end);

  intervals.forEach((interval, index) => {
    const occupied = new Set(intervals.slice(0, index).filter((previous) => previous.end > interval.start).map((previous) => previous.lane));
    while (occupied.has(interval.lane)) interval.lane++;
  });
  const previousByCategory = new Map<string, CcInterval>();
  intervals.forEach((interval) => {
    const previous = previousByCategory.get(interval.drCategory);
    if (previous && interval.start - previous.end <= 18) {
      interval.previousDrEnd = previous.end;
      interval.previousDrSpell = previous.spell;
      interval.previousDrSpellId = previous.spellId;
      interval.drGap = interval.start - previous.end;
    }
    if (!previous || interval.end >= previous.end) previousByCategory.set(interval.drCategory, interval);
  });
  return intervals;
}

function drOverlaps(participants: ParticipantDetails[], events: TimelineEvent[], duration: number): DrOverlap[] {
  return participants.flatMap((target) => {
    const intervals = healerCcIntervals(target, events, duration);
    const reducedApplications: DrOverlap[] = intervals
      .filter((interval) => interval.drGap != null && interval.previousDrEnd != null)
      .map((interval) => ({
        target,
        first: interval.previousDrSpell ?? "Previous CC",
        firstSpellId: interval.previousDrSpellId ?? 0,
        second: interval.spell,
        secondSpellId: interval.spellId,
        category: interval.drCategory,
        start: interval.start,
        end: Math.max(interval.start + 0.5, interval.end),
        gap: interval.drGap!,
        immune: false,
      }));
    const immuneAttempts: DrOverlap[] = events
      .filter((event) => event.category === "CROWD_CONTROL" && event.eventType === "SPELL_MISSED" && event.target === target.name)
      .flatMap((event) => {
        const category = drCategory(event.spell);
        const previous = intervals.filter((interval) => interval.drCategory === category && interval.start <= event.offsetSeconds && event.offsetSeconds - interval.end <= 18).at(-1);
        if (!previous) return [];
        return [{ target, first: previous.spell, firstSpellId: previous.spellId, second: event.spell, secondSpellId: event.spellId, category, start: event.offsetSeconds, end: event.offsetSeconds + 0.5, gap: event.offsetSeconds - previous.end, immune: true }];
      });
    return [...reducedApplications, ...immuneAttempts];
  }).sort((first, second) => first.start - second.start);
}

function isPvpTrinket(event: TimelineEvent): boolean {
  return event.spellId === 336126 || event.spellId === 208683 || event.spellId === 42292 || event.spell.toLowerCase().includes("gladiator's medallion");
}

function ccChains(intervals: CcInterval[], trinkets: TimelineEvent[]): CcChain[] {
  const chains: CcChain[] = [];
  intervals.forEach((interval) => {
    const current = chains.at(-1);
    const interruptedBeforeNextCc = current && trinkets.some((trinket) => trinket.offsetSeconds >= current.start && trinket.offsetSeconds <= interval.start);
    if (current && interval.start <= current.end && !interruptedBeforeNextCc) {
      current.end = Math.max(current.end, interval.end);
      current.totalDuration = Math.max(0, current.end - current.start);
      current.exactDuration = current.exactDuration && interval.exactDuration;
    } else chains.push({ start: interval.start, end: interval.end, totalDuration: Math.max(0, interval.end - interval.start), exactDuration: interval.exactDuration, trinket: null });
  });
  chains.forEach((chain) => {
    chain.trinket = trinkets.find((trinket) => trinket.offsetSeconds >= chain.start && trinket.offsetSeconds <= chain.end + 1) ?? null;
  });
  return chains;
}

function formatCcDuration(seconds: number): string {
  const rounded = Math.round(seconds * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}s`;
}

function resultLabel(match: ArenaMatch): string {
  return match.playerWins == null || match.playerLosses == null
    ? match.result
    : `${match.result} ${match.playerWins}-${match.playerLosses}`;
}

type MatchCategory = "solo-shuffle" | "2v2" | "3v3" | "skirmish";

const matchCategories: Array<{
  id: MatchCategory;
  title: string;
  description: string;
}> = [
  { id: "solo-shuffle", title: "Solo Shuffle", description: "Recent rated solo rounds" },
  { id: "2v2", title: "2v2", description: "Recent two-player team matches" },
  { id: "3v3", title: "3v3", description: "Recent three-player team matches" },
  { id: "skirmish", title: "Arena Skirmishes", description: "Recent unranked arena matches" },
];

function belongsToCategory(match: ArenaMatch, category: MatchCategory): boolean {
  const type = (match.matchType ?? "").toLowerCase().replaceAll(" ", "");

  if (category === "solo-shuffle") return type.includes("solo") || type.includes("shuffle");
  if (category === "2v2") return type.includes("2v2") || type.includes("2x2");
  if (category === "3v3") return type.includes("3v3") || type.includes("3x3");
  return type.includes("skirmish");
}

function formatDuration(totalSeconds: number): string {
  const roundedTotal = Math.max(0, Math.round(totalSeconds * 10) / 10);
  const minutes = Math.floor(roundedTotal / 60);
  const seconds = roundedTotal - minutes * 60;
  const secondsText = Number.isInteger(seconds)
    ? seconds.toFixed(0).padStart(2, "0")
    : seconds.toFixed(1).padStart(4, "0");
  return `${minutes}:${secondsText}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function compositionText(member: CompositionMember): string {
  return [member.specializationName, member.className].filter(Boolean).join(" ");
}

function matchesTerms(team: CompositionMember[], value: string): boolean {
  const haystacks = team.map((member) => `${member.name} ${member.className ?? ""} ${member.specializationName ?? ""}`.toLowerCase());
  return value.toLowerCase().split(",").map((term) => term.trim()).filter(Boolean).every((term) => haystacks.some((member) => member.includes(term)));
}

function barStyle(value: number, maximum: number): CSSProperties {
  return { "--bar-width": `${maximum > 0 ? (value / maximum) * 60 : 0}%` } as CSSProperties;
}

function healthBarStyle(healthAfter: number, maxHealth: number): CSSProperties {
  const percentage = maxHealth > 0 ? Math.max(0, Math.min(100, (healthAfter / maxHealth) * 100)) : 0;
  return { "--bar-width": `${percentage}%` } as CSSProperties;
}

function SpellIcon({ spellId, name, size = 28, showTitle = true }: { spellId: number; name?: string | null; size?: number; showTitle?: boolean }) {
  const resolvedId = spellId > 0 ? spellId : 6603;
  return <img className="spell-icon" src={`https://images.wowarenalogs.com/spells/${resolvedId}.jpg`} width={size} height={size} loading="lazy" alt="" title={showTitle ? name ?? "Unknown spell" : undefined} onError={(event) => { event.currentTarget.src = "https://images.wowarenalogs.com/spells/6603.jpg"; }} />;
}

function TimelineEventIcon({ event }: { event: TimelineEvent }) {
  return event.eventType === "UNIT_DIED"
    ? <span className="death-icon" aria-hidden="true">☠</span>
    : <SpellIcon spellId={event.spellId} name={event.spell} size={32} showTitle={false} />;
}

function timelineEventDescription(event: TimelineEvent, relatedEvents: TimelineEvent[], participants: ParticipantDetails[]): string {
  if (event.eventType === "UNIT_DIED") return `${event.target ?? event.source} died at ${formatDuration(event.offsetSeconds)}`;
  return `${event.spell} → ${timelineTargetsLabel(event, relatedEvents, participants)}`;
}

function BattleNetIcon({ type, id, name, region, size = 38 }: { type: "item" | "spell"; id?: number; name?: string; region: string; size?: number }) {
  if (!id) return <span className="missing-game-icon" style={{ width: size, height: size }}>?</span>;
  return <img className="game-icon" src={`/api/media/${type}/${id}?region=${region}`} width={size} height={size} loading="lazy" alt="" title={name} />;
}

function treeIdFromHref(href?: string): number | null {
  const match = href?.match(/talent-tree\/(\d+)/);
  return match ? Number(match[1]) : null;
}

function WowTalentTree({ title, nodes, selected, region }: { title: string; nodes: TreeNode[]; selected: TalentChoice[]; region: string }) {
  if (!nodes.length) return null;
  const selectedByNode = new Map(selected.map((talent) => [talent.id, talent]));
  const positions = nodes.map((node) => ({ node, x: node.raw_position_x ?? (node.display_col ?? 0) * 600, y: node.raw_position_y ?? (node.display_row ?? 0) * 600 }));
  const minX = Math.min(...positions.map((entry) => entry.x)); const maxX = Math.max(...positions.map((entry) => entry.x));
  const minY = Math.min(...positions.map((entry) => entry.y)); const maxY = Math.max(...positions.map((entry) => entry.y));
  const width = 760; const height = Math.max(430, ((maxY - minY) / Math.max(1, maxX - minX)) * 700);
  const point = (value: number, minimum: number, maximum: number, size: number) => 34 + ((value - minimum) / Math.max(1, maximum - minimum)) * (size - 68);
  const byId = new Map(positions.map((entry) => [entry.node.id, entry]));
  return <section className="wow-tree"><h4>{title}</h4><div className="wow-tree-canvas" style={{ aspectRatio: `${width} / ${height}` }}>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">{positions.flatMap(({ node, x, y }) => (node.unlocks ?? []).map((targetId) => {
      const target = byId.get(targetId); if (!target) return null;
      const active = selectedByNode.has(node.id) && selectedByNode.has(targetId);
      return <line className={active ? "selected" : ""} key={`${node.id}-${targetId}`} x1={point(x,minX,maxX,width)} y1={point(y,minY,maxY,height)} x2={point(target.x,minX,maxX,width)} y2={point(target.y,minY,maxY,height)} />;
    }))}</svg>
    {positions.map(({ node, x, y }) => {
      const choice = selectedByNode.get(node.id); const rank = choice?.rank ?? 0;
      const definition = choice?.tooltip ?? node.ranks?.[Math.max(0, rank - 1)]?.tooltip ?? node.ranks?.[0]?.tooltip;
      const name = definition?.talent?.name ?? definition?.spell_tooltip?.spell?.name ?? `Talent ${node.id}`;
      const spellId = definition?.spell_tooltip?.spell?.id; const maxRank = node.ranks?.length ?? 1;
      return <div className={`wow-tree-node ${choice ? "selected" : "unselected"} ${node.node_type?.type?.toLowerCase() ?? ""}`} style={{ left: `${(point(x,minX,maxX,width)/width)*100}%`, top: `${(point(y,minY,maxY,height)/height)*100}%` }} title={`${name}${definition?.spell_tooltip?.description ? `\n${definition.spell_tooltip.description}` : ""}`} key={node.id}>
        <BattleNetIcon type="spell" id={spellId} name={name} region={region} size={42} /><b>{rank}/{maxRank}</b><small>{name}</small>
      </div>;
    })}
  </div></section>;
}

function ProfileDetails({ character, onClose, onSync, syncing }: { character: TrackedCharacter; onClose: () => void; onSync: () => void; syncing: boolean }) {
  const items = character.equipment?.equipped_items ?? [];
  const loadouts = character.specializations?.specializations ?? [];
  const activeSpecialization = loadouts.find((specialization) => specialization.specialization?.name === character.activeSpecialization) ?? loadouts[0];
  const active = activeSpecialization?.loadouts?.find((loadout) => loadout.is_active) ?? activeSpecialization?.loadouts?.[0];
  const [treeData, setTreeData] = useState<TalentTreeData | null>(null);
  const [treeError, setTreeError] = useState<string | null>(null);
  const treeId = treeIdFromHref(active?.selected_class_talent_tree?.key?.href);
  const specializationId = activeSpecialization?.specialization?.id;
  useEffect(() => {
    setTreeData(null); setTreeError(null);
    if (!treeId || !specializationId) return;
    fetch(`/api/talent-trees/${treeId}/specializations/${specializationId}?region=${character.region}`)
      .then((response) => { if (!response.ok) throw new Error(`Talent tree returned ${response.status}`); return response.json(); })
      .then((data: TalentTreeData) => setTreeData(data)).catch((error: Error) => setTreeError(error.message));
  }, [treeId, specializationId, character.region]);
  return <div className="modal-backdrop profile-modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="profile-detail" role="dialog" aria-modal="true" aria-labelledby="profile-detail-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className="profile-detail-header">
        {character.avatarUrl ? <img src={character.avatarUrl} alt="" /> : <span className="profile-avatar large">{character.name.slice(0, 2).toUpperCase()}</span>}
        <div><p className="eyebrow">{character.region.toUpperCase()} · {character.realmSlug}</p><h2 id="profile-detail-title">{character.name}</h2><p>{[character.activeSpecialization, character.characterClass].filter(Boolean).join(" ") || "Profile not synced"}</p></div>
        <button className="secondary-button" onClick={onSync} disabled={syncing}>{syncing ? "Syncing…" : "Sync profile"}</button>
        <button className="close-button" onClick={onClose} aria-label="Close profile">×</button>
      </header>
      <div className="profile-summary">
        <div><span>Level</span><strong>{character.level ?? "–"}</strong></div><div><span>Item level</span><strong>{character.itemLevel ?? "–"}</strong></div><div><span>Achievement points</span><strong>{character.achievementPoints?.toLocaleString("en-GB") ?? "–"}</strong></div><div><span>Last synced</span><strong>{character.lastSyncedAt ? formatDate(character.lastSyncedAt) : "Never"}</strong></div>
      </div>
      {character.syncError && <div className="message error">{character.syncError}</div>}
      <section className="profile-detail-section"><div className="section-heading"><div><p className="eyebrow">Current snapshot</p><h3>Equipment</h3></div><span>{items.length} equipped items</span></div>
        {items.length ? <div className="equipment-grid">{items.map((item, index) => <article className={`equipment-item quality-${(item.quality?.type ?? "common").toLowerCase()}`} key={`${item.slot?.type}-${item.item?.id}-${index}`}>
          <BattleNetIcon type="item" id={item.media?.id ?? item.item?.id} name={item.name} region={character.region} size={42} /><span className="item-slot">{item.slot?.name ?? "Item"}</span><strong>{item.name ?? `Item ${item.item?.id ?? ""}`}</strong><small>{item.level?.display_string ?? "Unknown item level"}</small>
          {(item.stats?.length ?? 0) > 0 && <p>{item.stats?.map((stat) => stat.display?.display_string ?? `${stat.value ?? ""} ${stat.type?.name ?? ""}`).join(" · ")}</p>}
          {item.enchantments?.map((enchant, enchantIndex) => <em key={enchant.enchantment_id ?? enchantIndex}>{enchant.display_string ?? "Enchanted"}</em>)}
          {item.sockets?.map((socket, socketIndex) => <em key={socket.item?.id ?? socketIndex}>{socket.item?.name ?? socket.display_string ?? socket.socket_type?.name}</em>)}
        </article>)}</div> : <p className="profile-empty">Sync the profile to retrieve equipment.</p>}
      </section>
      <section className="profile-detail-section"><div className="section-heading"><div><p className="eyebrow">Active loadout</p><h3>Talents</h3></div><span>{active?.selected_hero_talent_tree?.name ?? character.specializations?.active_hero_talent_tree?.name ?? ""}</span></div>
        {active ? <>{treeData ? <div className="wow-trees"><WowTalentTree title={active.selected_class_talent_tree?.name ?? "Class tree"} nodes={treeData.class_talent_nodes ?? []} selected={active.selected_class_talents ?? []} region={character.region} /><WowTalentTree title={active.selected_spec_talent_tree?.name ?? "Specialization tree"} nodes={treeData.spec_talent_nodes ?? []} selected={active.selected_spec_talents ?? []} region={character.region} /><WowTalentTree title={active.selected_hero_talent_tree?.name ?? "Hero tree"} nodes={treeData.hero_talent_trees?.find((tree) => tree.id === active.selected_hero_talent_tree?.id)?.hero_talent_nodes ?? []} selected={active.selected_hero_talents ?? []} region={character.region} /></div> : treeError ? <p className="profile-empty">Could not load the talent-tree layout: {treeError}</p> : <p className="profile-empty">Loading talent-tree layout…</p>}
          <div className="pvp-talents"><h4>PvP talents</h4>{(activeSpecialization?.pvp_talent_slots ?? []).map((slot, index) => <span title={slot.selected?.spell_tooltip?.description} key={slot.slot_number ?? index}><BattleNetIcon type="spell" id={slot.selected?.spell_tooltip?.spell?.id} name={slot.selected?.talent?.name} region={character.region} size={32} />{slot.selected?.talent?.name ?? slot.selected?.spell_tooltip?.spell?.name ?? "Empty slot"}</span>)}</div>
          {active.talent_loadout_code && <details className="loadout-code"><summary>Talent loadout code</summary><code>{active.talent_loadout_code}</code></details>}
        </> : <p className="profile-empty">Sync the profile to retrieve talents.</p>}
      </section>
    </section>
  </div>;
}

function MatchList({ matches, emptyMessage, onSelect }: { matches: ArenaMatch[]; emptyMessage: string; onSelect: (match: ArenaMatch) => void }) {
  if (matches.length === 0) {
    return <div className="empty-state compact"><strong>No matches yet</strong><p>{emptyMessage}</p></div>;
  }

  return (
    <div className="match-list">
      <div className="match-row table-header" aria-hidden="true">
        <span>Result</span><span>Arena</span><span>Compositions</span><span>Type</span><span>Date</span><span>Duration</span>
      </div>
      {matches.map((match) => (
        <button className="match-row match-row-button" key={match.id} onClick={() => onSelect(match)} aria-label={`View details for ${match.arena}`}>
          <span className={`result-badge ${match.result.toLowerCase()}`}>{resultLabel(match)}</span>
          <span className="arena-name"><strong>{match.arena}</strong><small>Instance {match.instanceId ?? "–"}</small></span>
          <span className="composition-cell">
            <small>Your team</small><span>{match.yourTeam.map((member) => <i key={`${member.name}-your`} title={member.name}>{compositionText(member)}</i>)}</span>
            <small>Opponents</small><span>{match.opponentTeam.map((member) => <i key={`${member.name}-opponent`} title={member.name}>{compositionText(member)}</i>)}</span>
          </span>
          <span data-label="Type">{match.matchType ?? "Unknown"}</span>
          <span data-label="Date">{formatDate(match.startedAt)}</span>
          <span data-label="Duration" className="duration">{formatDuration(match.durationSeconds)}</span>
        </button>
      ))}
    </div>
  );
}

function MmrChart({ title, matches }: { title: string; matches: ArenaMatch[] }) {
  const points = matches.filter((match) => (match.playerMmr ?? 0) > 0).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const ratings = points.map((match) => match.playerMmr as number);
  const minimum = ratings.length > 0 ? Math.min(...ratings) : 0;
  const maximum = ratings.length > 0 ? Math.max(...ratings) : 0;
  const axisStep = Math.max(50, Math.ceil(Math.max(1, maximum - minimum) / 3 / 50) * 50);
  const axisMinimum = ratings.length > 0 ? Math.max(0, Math.floor(minimum / axisStep) * axisStep) : 0;
  const axisMaximum = ratings.length > 0 ? Math.max(axisMinimum + axisStep, Math.ceil(maximum / axisStep) * axisStep) : axisStep;
  const ticks = Array.from({ length: Math.round((axisMaximum - axisMinimum) / axisStep) + 1 }, (_, index) => axisMinimum + index * axisStep).reverse();
  const x = (index: number) => points.length === 1 ? 50 : 3 + (index / (points.length - 1)) * 94;
  const y = (rating: number) => 94 - ((rating - axisMinimum) / Math.max(1, axisMaximum - axisMinimum)) * 88;
  const polyline = points.map((match, index) => `${x(index)},${y(match.playerMmr!)}`).join(" ");
  return (
    <article className="mmr-card">
      <div><span>{title}</span><strong>{ratings.at(-1) ?? "—"}</strong></div>
      {ratings.length === 0 ? <p>No rated matches yet</p> : <div className="mmr-chart-wrap">
        <div className="mmr-axis" aria-hidden="true">{ticks.map((tick) => <span key={tick}>{tick}</span>)}</div>
        <svg className="mmr-line-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${title} history from ${minimum} to ${maximum}`}>
          {ticks.map((tick) => <line className="mmr-grid-line" key={tick} x1="0" x2="100" y1={y(tick)} y2={y(tick)} />)}
          <polyline className="mmr-line" points={polyline} />
        </svg>
      </div>}
      <small>{ratings.length > 0 ? `${minimum}–${maximum} · all ${ratings.length} matches` : "Team rating from combat logs"}</small>
    </article>
  );
}

function SpellSection({ title, spells, metric }: { title: string; spells: SpellStatistic[]; metric: "damage" | "healing" | "damageTaken" }) {
  const sorted = spells.filter((spell) => spell[metric] > 0).sort((a, b) => b[metric] - a[metric]);
  const maximum = sorted[0]?.[metric] ?? 0;
  return (
    <details className="breakdown-section">
      <summary><span>{title}</span><strong>{formatNumber(sorted.reduce((sum, spell) => sum + spell[metric], 0))}</strong></summary>
      {sorted.length === 0 ? <p className="no-breakdown">No {title.toLowerCase()} recorded.</p> : (
        <div className="breakdown-list">
          {sorted.map((spell) => <div className={`bar-row ${metric === "healing" ? "healing-bar" : "damage-bar"}`} style={barStyle(spell[metric], maximum)} key={`${metric}-${spell.spellId}`}><SpellIcon spellId={spell.spellId} name={spell.name} /><span>{spell.name}</span><strong>{formatNumber(spell[metric])}</strong></div>)}
        </div>
      )}
    </details>
  );
}

function UtilitySection({ title, actions }: { title: string; actions: UtilityAction[] }) {
  return (
    <details className="breakdown-section">
      <summary><span>{title}</span><strong>{actions.length}</strong></summary>
      {actions.length === 0 ? <p className="no-breakdown">No {title.toLowerCase()} recorded.</p> : (
        <div className="utility-list">
          {actions.map((action, index) => (
            <div key={`${title}-${action.offsetSeconds}-${index}`}>
              <time>{formatDuration(action.offsetSeconds)}</time>
              <SpellIcon spellId={action.affectedSpellId || action.spellId} name={action.affectedSpell ?? action.spell} />
              <span><strong>{action.spell ?? title.slice(0, -1)}</strong> on {action.target ?? "Unknown"}<small>{action.affectedSpell ? `Removed/stopped: ${action.affectedSpell}` : ""}</small></span>
            </div>
          ))}
        </div>
      )}
    </details>
  );
}

function DeathRecapSection({ recaps }: { recaps: DeathRecap[] }) {
  return (
    <details className="breakdown-section death-recaps">
      <summary><span>Death recaps</span><strong>{recaps.length}</strong></summary>
      {recaps.length === 0 ? <p className="no-breakdown">No deaths recorded.</p> : recaps.map((recap) => (
        <div className="death-recap" key={`${recap.deathNumber}-${recap.offsetSeconds}`}>
          <h4>Death {recap.deathNumber} <span>at {formatDuration(recap.offsetSeconds)}</span></h4>
          {recap.receivedEvents.length === 0 ? <p>No damage or healing in the final two seconds.</p> : recap.receivedEvents.map((event, index) => (
            <div className={`bar-row ${event.type === "HEALING" ? "healing-bar" : "damage-bar"}`} style={healthBarStyle(event.healthAfter, event.maxHealth)} key={`${event.secondsBeforeDeath}-${index}`}>
              <time>-{event.secondsBeforeDeath.toFixed(2)}s</time><SpellIcon spellId={event.spellId} name={event.spell} /><span>{event.spell ?? event.type} <small>from {event.source ?? "Unknown"}</small></span><span className="recap-values"><strong>{event.type === "HEALING" ? "+" : "-"}{formatNumber(event.amount)}</strong><small>{formatNumber(event.healthAfter)} / {formatNumber(event.maxHealth)} HP</small></span>
            </div>
          ))}
        </div>
      ))}
    </details>
  );
}

function CooldownTimeline({ events, relatedEvents = events, duration, playerTeam, participants, title = "Cooldown timeline", eyebrow = "Midnight 12.1 important spells" }: { events: TimelineEvent[]; relatedEvents?: TimelineEvent[]; duration: number; playerTeam: number | null; participants: ParticipantDetails[]; title?: string; eyebrow?: string }) {
  const visibleEvents = events.filter((event) => event.eventType !== "SPELL_AURA_REMOVED");
  const rows = Array.from({ length: Math.ceil(visibleEvents.length / 20) }, (_, index) => {
    const rowEvents = visibleEvents.slice(index * 20, index * 20 + 20);
    const startSeconds = index === 0 ? 0 : visibleEvents[index * 20 - 1].offsetSeconds;
    const endSeconds = rowEvents.length === 20
      ? rowEvents[rowEvents.length - 1].offsetSeconds
      : duration;

    return { events: rowEvents, startSeconds, endSeconds };
  });
  return (
    <section className="timeline-panel">
      <div className="timeline-heading"><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div><span>{visibleEvents.length} events</span></div>
      {visibleEvents.length === 0 ? <p className="timeline-empty">No tracked cooldowns were used in this match.</p> : (
        <div className="timeline-rows">
          {rows.map((row, rowIndex) => (
            <div className="timeline-track" key={rowIndex}>
              <span className="timeline-team-label team-one">{playerTeam == null ? "Team 1" : "Same team"}</span><span className="timeline-team-label team-two">{playerTeam == null ? "Team 2" : "Opponents"}</span>
              <div className="timeline-axis"><span>{formatDuration(row.startSeconds)}</span><span>{formatDuration(row.endSeconds)}</span></div>
              {row.events.map((event, index) => {
                const sideFor = (candidate: TimelineEvent) => {
                  const sourceTeam = timelineEventTeam(candidate, participants);
                  return playerTeam == null ? (sourceTeam ?? 0) : sourceTeam === playerTeam ? 0 : 1;
                };
                const side = sideFor(event);
                const left = `${row.endSeconds > row.startSeconds ? Math.min(100, Math.max(0, ((event.offsetSeconds - row.startSeconds) / (row.endSeconds - row.startSeconds)) * 100)) : 0}%`;
                const stackIndex = timelineStackIndex(row.events, index, sideFor, Math.max(0.75, (row.endSeconds - row.startSeconds) * 0.05));
                const description = timelineEventDescription(event, relatedEvents, participants);
                return <button className={`timeline-event ${event.category.toLowerCase()} team-${side}`} style={timelineEventStyle(left, stackIndex)} key={`${event.offsetSeconds}-${event.spellId}-${index}`} data-tooltip={description} aria-label={description}>
                  <TimelineEventIcon event={event} />
                </button>;
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function personalTimelineEvents(player: ParticipantDetails, events: TimelineEvent[]): TimelineEvent[] {
  return deduplicateTimelineEvents(events.filter((event) =>
    (event.eventType === "UNIT_DIED" && event.target === player.name) ||
    (event.source === player.name && (event.eventType === "SPELL_CAST_SUCCESS" || event.eventType === "SPELL_AURA_APPLIED")) ||
    (event.target === player.name && event.eventType === "SPELL_AURA_APPLIED")
  ));
}

function PlayerTimeline({ player, events, duration, participants }: { player: ParticipantDetails; events: TimelineEvent[]; duration: number; participants: ParticipantDetails[] }) {
  const personalEvents = personalTimelineEvents(player, events);

  return <CooldownTimeline events={personalEvents} relatedEvents={events} duration={duration} playerTeam={player.team} participants={participants} title={`${player.name}'s timeline`} eyebrow="Used and received important spells" />;
}

function ComparisonTimeline({ players, events, duration, participants, playerTeam }: { players: ParticipantDetails[]; events: TimelineEvent[]; duration: number; participants: ParticipantDetails[]; playerTeam: number | null }) {
  const windows = Array.from({ length: Math.max(1, Math.ceil(duration / 30)) }, (_, index) => ({ start: index * 30, end: index * 30 + 30 }));
  return <section className="timeline-panel comparison-timeline">
    <div className="timeline-heading"><div><p className="eyebrow">Synchronized 30-second windows</p><h3>Player timeline comparison</h3></div><span>{players.length} selected</span></div>
    {players.length === 0 ? <p className="timeline-empty">Select one or more characters to compare their timelines.</p> : <div className="comparison-windows">
      {windows.map((window) => <section className="comparison-window" key={window.start}>
        <header><strong>{formatDuration(window.start)}–{formatDuration(window.end)}</strong><span>All selected players · same time scale</span></header>
        {players.map((player) => {
          const personalEvents = personalTimelineEvents(player, events).filter((event) => event.offsetSeconds >= window.start && event.offsetSeconds < window.end);
          const onYourTeam = playerTeam != null && player.team === playerTeam;
          return <div className="comparison-player-row" key={`${window.start}-${player.guid}`}>
            <div className="comparison-player-label"><span className={`team-affiliation ${onYourTeam ? "yours" : "enemy"}`}>{onYourTeam ? "Your team" : "Opponent"}</span><strong>{player.name}</strong><small>{player.specializationName} {player.className}</small></div>
            <div className="timeline-track comparison-track">
              <span className="timeline-team-label team-one">Ally used</span><span className="timeline-team-label team-two">Enemy used</span>
              <div className="timeline-axis"><span>{formatDuration(window.start)}</span><span>{formatDuration(window.end)}</span></div>
              {personalEvents.map((event, index) => {
                const ally = player.team != null && timelineEventTeam(event, participants) === player.team;
                const sideFor = (candidate: TimelineEvent) => player.team != null && timelineEventTeam(candidate, participants) === player.team ? 0 : 1;
                const stackIndex = timelineStackIndex(personalEvents, index, sideFor, 1.5);
                const left = `${Math.min(100, Math.max(0, ((event.offsetSeconds - window.start) / 30) * 100))}%`;
                const description = timelineEventDescription(event, events, participants);
                return <button className={`timeline-event ${event.category.toLowerCase()} team-${ally ? 0 : 1}`} style={timelineEventStyle(left, stackIndex)} key={`${event.offsetSeconds}-${event.spellId}-${index}`} data-tooltip={description} aria-label={description}>
                  <TimelineEventIcon event={event} />
                </button>;
              })}
            </div>
          </div>;
        })}
      </section>)}
    </div>}
  </section>;
}

function DefensiveOverlapWarnings({ overlaps }: { overlaps: DefensiveOverlap[] }) {
  if (overlaps.length === 0) return null;
  return <div className="timeline-warning-list">
    <strong><span>!</span> Defensive overlaps</strong>
    {overlaps.map((overlap, index) => <div className="timeline-warning-row" key={`${overlap.target}-${overlap.start}-${index}`}>
      <span className="warning-spell-icons"><SpellIcon spellId={overlap.firstSpellId} name={overlap.first} size={24} /><SpellIcon spellId={overlap.secondSpellId} name={overlap.second} size={24} /></span>
      <p><b>{overlap.target}</b> · {overlap.first} + {overlap.second}<small>{formatCcDuration(overlap.end - overlap.start)} overlap at {formatDuration(overlap.start)}</small></p>
    </div>)}
  </div>;
}

function DrOverlapTimeline({ overlaps, duration, playerTeam }: { overlaps: DrOverlap[]; duration: number; playerTeam: number | null }) {
  const activeWindowStarts = [...new Set(overlaps.map((overlap) => Math.floor(overlap.start / 30) * 30))];

  return <section className="timeline-panel dr-overlap-panel">
    <div className="timeline-heading"><div><p className="eyebrow">Repeated CC inside the DR reset window</p><h3>DR overlap timeline</h3></div><span>{overlaps.length} DR issues</span></div>
    {overlaps.length === 0 ? <p className="timeline-empty">No repeated or immune crowd control inside an active DR window was found.</p> : <div className="cc-windows dr-overlap-windows">
      {activeWindowStarts.map((windowStart) => {
        const windowEnd = Math.min(windowStart + 30, duration);
        const windowOverlaps = overlaps.filter((overlap) => overlap.end > windowStart && overlap.start < windowStart + 30);
        const targets = [...new Map(windowOverlaps.map((overlap) => [overlap.target.guid, overlap.target])).values()];
        return <section className="cc-window" key={windowStart}>
          <header><strong>{formatDuration(windowStart)}–{formatDuration(windowStart + 30)}</strong><span>DR issues only</span></header>
          {targets.map((target) => {
            const yourTeam = playerTeam != null && target.team === playerTeam;
            const targetOverlaps = windowOverlaps.filter((overlap) => overlap.target.guid === target.guid);
            return <div className="cc-healer-row dr-overlap-row" key={`${windowStart}-${target.guid}`}>
              <div className="comparison-player-label"><span className={`team-affiliation ${yourTeam ? "yours" : "enemy"}`}>{yourTeam ? "Your team" : "Opponent"}</span><strong>{target.name}</strong><small>{target.specializationName} {target.className}</small></div>
              <div className="dr-overlap-track">
                <div className="cc-axis"><span>{formatDuration(windowStart)}</span><span>{formatDuration(windowEnd)}</span></div>
                {targetOverlaps.map((overlap, index) => {
                  const start = Math.max(windowStart, overlap.start);
                  const end = Math.min(windowStart + 30, overlap.end);
                  const relation = overlap.immune ? "Immune" : overlap.gap < 0 ? `${formatCcDuration(Math.abs(overlap.gap))} duration overlap` : `${formatCcDuration(overlap.gap)} after previous CC ended`;
                  const description = `${overlap.first} → ${overlap.second} on ${target.name} · ${relation} · ${overlap.category} DR at ${formatDuration(overlap.start)}`;
                  return <button className={`dr-overlap-marker ${overlap.immune ? "immune" : ""}`} style={{ left: `${((start - windowStart) / 30) * 100}%`, width: `${Math.max(3, ((end - start) / 30) * 100)}%`, top: `${5 + (index % 3) * 18}px` }} data-tooltip={description} aria-label={description} key={`${overlap.start}-${overlap.secondSpellId}-${index}`}>
                    <span className="warning-spell-icons"><SpellIcon spellId={overlap.firstSpellId} name={overlap.first} size={22} showTitle={false} /><SpellIcon spellId={overlap.secondSpellId} name={overlap.second} size={22} showTitle={false} /></span>
                    <b>{overlap.immune ? "IMMUNE" : "DR"}</b>
                  </button>;
                })}
              </div>
            </div>;
          })}
        </section>;
      })}
    </div>}
  </section>;
}

function HealerCcTimeline({ events, duration, participants, playerTeam }: { events: TimelineEvent[]; duration: number; participants: ParticipantDetails[]; playerTeam: number | null }) {
  const healers = participants.filter((player) => healerSpecializations.has(player.specializationName));
  const windows = Array.from({ length: Math.max(1, Math.ceil(duration / 30)) }, (_, index) => ({ start: index * 30, end: index * 30 + 30 }));
  const data = new Map(healers.map((healer) => {
    const intervals = healerCcIntervals(healer, events, duration);
    const trinkets = deduplicateTimelineEvents(events).filter((event) => event.source === healer.name && isPvpTrinket(event));
    const deaths = deduplicateTimelineEvents(events).filter((event) => {
      if (event.eventType !== "UNIT_DIED") return false;
      const deadPlayer = participants.find((player) => player.name === (event.target ?? event.source));
      return deadPlayer != null && deadPlayer.team === healer.team;
    });
    return [healer.guid, { intervals, chains: ccChains(intervals, trinkets), trinkets, deaths }];
  }));
  const drFollowups = Array.from(data.values()).reduce((total, healerData) => total + healerData.intervals.filter((interval) => interval.drGap != null).length, 0);
  const drIssues = healers.flatMap((healer) => (data.get(healer.guid)?.intervals ?? []).filter((interval) => interval.drGap != null).map((interval) => ({ healer, interval })));

  return <section className="timeline-panel cc-timeline-panel">
    <div className="timeline-heading"><div><p className="eyebrow">Crowd control duration and overlap</p><h3>CC/chains on healers</h3></div><span>{drFollowups > 0 ? `! ${drFollowups} DR follow-ups` : `${healers.length} healers`}</span></div>
    {drIssues.length > 0 && <div className="timeline-warning-list dr-warning-list">
      <strong><span>!</span> DR issues</strong>
      {drIssues.map(({ healer, interval }, index) => {
        const timing = interval.drGap! < 0 ? `${formatCcDuration(Math.abs(interval.drGap!))} overlap` : interval.drGap === 0 ? "No gap" : `${formatCcDuration(interval.drGap!)} gap`;
        return <div className="timeline-warning-row" key={`${healer.guid}-${interval.start}-${index}`}>
          <span className="warning-spell-icons"><SpellIcon spellId={interval.previousDrSpellId ?? 0} name={interval.previousDrSpell} size={24} /><SpellIcon spellId={interval.spellId} name={interval.spell} size={24} /></span>
          <p><b>{healer.name}</b> · {interval.previousDrSpell} → {interval.spell}<small>{timing} · {interval.drCategory} DR · second CC at {formatDuration(interval.start)}</small></p>
        </div>;
      })}
    </div>}
    {healers.length === 0 ? <p className="timeline-empty">No healer specialization was identified in this match.</p> : <div className="cc-windows">
      {windows.map((window) => <section className="cc-window" key={window.start}>
        <header><strong>{formatDuration(window.start)}–{formatDuration(window.end)}</strong><span>30-second comparison</span></header>
        {healers.map((healer) => {
          const healerData = data.get(healer.guid)!;
          const yourHealer = playerTeam != null && healer.team === playerTeam;
          const visibleIntervals = healerData.intervals.filter((interval) => interval.end > window.start && interval.start < window.end);
          const visibleChains = healerData.chains.filter((chain) => chain.end > window.start && chain.start < window.end);
          const laneCount = Math.max(1, ...visibleIntervals.map((interval) => interval.lane + 1));
          return <div className="cc-healer-row" key={`${window.start}-${healer.guid}`}>
            <div className="comparison-player-label"><span className={`team-affiliation ${yourHealer ? "yours" : "enemy"}`}>{yourHealer ? "Your healer" : "Enemy healer"}</span><strong>{healer.name}</strong><small>{healer.specializationName} {healer.className}</small></div>
            <div className="cc-track" style={{ height: `${70 + (laneCount - 1) * 25}px` }}>
              <div className="cc-chain-layer">
                {visibleChains.map((chain, index) => {
                  const start = Math.max(window.start, chain.start); const end = Math.min(window.end, chain.end);
                  const chainLabel = chain.exactDuration ? `${formatCcDuration(chain.totalDuration)} chain` : "chain duration unavailable";
                  return <span className={`cc-chain-span ${chain.trinket ? "trinketed" : ""}`} style={{ left: `${((start - window.start) / 30) * 100}%`, width: `${Math.max(1, ((end - start) / 30) * 100)}%` }} key={`${chain.start}-${index}`}><b>{chainLabel}{chain.trinket ? " · trinketed" : ""}</b></span>;
                })}
              </div>
              {visibleIntervals.filter((interval) => interval.previousDrEnd != null && interval.drGap != null).map((interval, index) => {
                const relationStart = Math.min(interval.previousDrEnd!, interval.start); const relationEnd = Math.max(interval.previousDrEnd!, interval.start);
                if (relationEnd < window.start || relationStart >= window.end) return null;
                const start = Math.max(window.start, relationStart); const end = Math.min(window.end, relationEnd);
                const overlap = interval.drGap! < 0;
                const relationLabel = overlap ? `${formatCcDuration(Math.abs(interval.drGap!))} overlap · ${interval.drCategory} DR refreshed` : interval.drGap === 0 ? `Immediate ${interval.drCategory} DR refresh` : `${formatCcDuration(interval.drGap!)} gap · ${interval.drCategory} DR refreshed`;
                return <span className={`cc-dr-link ${overlap ? "overlap" : "gap"}`} style={{ left: `${((start - window.start) / 30) * 100}%`, width: `${Math.max(1.2, ((end - start) / 30) * 100)}%` }} data-tooltip={relationLabel} key={`${interval.start}-${interval.drCategory}-${index}`}><b>{relationLabel}</b></span>;
              })}
              {visibleIntervals.map((interval, index) => {
                const start = Math.max(window.start, interval.start); const end = Math.min(window.end, interval.end);
                const durationLabel = interval.exactDuration ? formatCcDuration(interval.end - interval.start) : "duration unavailable";
                return <button className="cc-duration-bar" style={{ left: `${((start - window.start) / 30) * 100}%`, width: `${Math.max(1.4, ((end - start) / 30) * 100)}%`, top: `${30 + interval.lane * 25}px` }} data-tooltip={`${interval.spell} from ${interval.source} · ${durationLabel} · ${interval.drCategory} DR`} aria-label={`${interval.spell} on ${healer.name} from ${formatDuration(interval.start)} to ${interval.exactDuration ? formatDuration(interval.end) : "unknown"}, ${interval.drCategory} DR`} key={`${interval.start}-${interval.spellId}-${index}`}>
                  <SpellIcon spellId={interval.spellId} name={interval.spell} size={18} showTitle={false} /><span>{interval.spell}</span><b>{interval.exactDuration ? formatCcDuration(interval.end - interval.start) : "?"}</b>
                </button>;
              })}
              {healerData.trinkets.filter((trinket) => trinket.offsetSeconds >= window.start && trinket.offsetSeconds < window.end).map((trinket, index) => {
                const breaksChain = healerData.chains.some((chain) => chain.trinket === trinket);
                const description = `Gladiator's Medallion used by ${healer.name} at ${formatDuration(trinket.offsetSeconds)}${breaksChain ? " · CC chain interrupted" : ""}`;
                return <button className={`cc-trinket-marker ${breaksChain ? "breaks-chain" : ""}`} style={{ left: `${((trinket.offsetSeconds - window.start) / 30) * 100}%` }} data-tooltip={description} aria-label={description} key={`${trinket.offsetSeconds}-${index}`}>
                  <SpellIcon spellId={trinket.spellId} name={trinket.spell} size={20} showTitle={false} />
                </button>;
              })}
              {healerData.deaths.filter((death) => death.offsetSeconds >= window.start && (death.offsetSeconds < window.end || window.end >= duration)).map((death, index) => {
                const deadPlayer = participants.find((player) => player.name === (death.target ?? death.source));
                const deadLabel = deadPlayer ? `${deadPlayer.specializationName} ${deadPlayer.className}` : death.target ?? death.source;
                const description = `${deadLabel} death at ${formatDuration(death.offsetSeconds)}`;
                const position = Math.min(98, Math.max(2, ((death.offsetSeconds - window.start) / 30) * 100));
                return <button className="cc-death-marker" style={{ left: `${position}%` }} data-tooltip={description} aria-label={description} key={`${death.offsetSeconds}-${death.target}-${index}`}>
                  <span aria-hidden="true">☠</span><b>{deadLabel} death</b>
                </button>;
              })}
              <div className="cc-axis"><span>{formatDuration(window.start)}</span><span>{formatDuration(window.end)}</span></div>
            </div>
          </div>;
        })}
      </section>)}
    </div>}
  </section>;
}

function PlayerCard({ player, timelineOpen, onToggleTimeline }: { player: ParticipantDetails; timelineOpen: boolean; onToggleTimeline: () => void }) {
  return (
    <article className="player-card">
      <div className="player-heading"><span className="player-identity"><strong>{player.name}</strong><small>{player.className ?? "Unknown class"} · {player.specializationName ?? "Unknown specialization"}</small></span><span>{player.kills} K · {player.deaths} D</span></div>
      <div className="player-metrics">
        <span><small>Damage</small>{formatNumber(player.damage)}</span>
        <span><small>Healing</small>{formatNumber(player.healing)}</span>
        <span><small>Absorbs</small>{formatNumber(player.absorbs)}</span>
        <span><small>Damage taken</small>{formatNumber(player.damageTaken)}</span>
        <span><small>Utility</small>{player.interrupts} int · {player.dispels} disp</span>
      </div>
      <button className={`player-timeline-button ${timelineOpen ? "active" : ""}`} onClick={onToggleTimeline}>
        {timelineOpen ? "Hide spell timeline" : "Show spell timeline"}
      </button>
      <div className="player-breakdowns">
        <SpellSection title="Damage" spells={player.spells} metric="damage" />
        <SpellSection title="Healing" spells={player.spells} metric="healing" />
        <SpellSection title="Damage taken" spells={player.spells} metric="damageTaken" />
        <UtilitySection title="Dispels" actions={player.dispelDetails} />
        <UtilitySection title="Interrupts" actions={player.interruptDetails} />
        <DeathRecapSection recaps={player.deathRecaps} />
      </div>
    </article>
  );
}

function App() {
  const [matches, setMatches] = useState<ArenaMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [reimporting, setReimporting] = useState(false);
  const [shuttingDown, setShuttingDown] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<ArenaMatch | null>(null);
  const [matchDetails, setMatchDetails] = useState<MatchDetails | null>(null);
  const [selectedRound, setSelectedRound] = useState(1);
  const [timelinePlayerGuid, setTimelinePlayerGuid] = useState<string | null>(null);
  const [healerCcTimelineOpen, setHealerCcTimelineOpen] = useState(false);
  const [drOverlapTimelineOpen, setDrOverlapTimelineOpen] = useState(false);
  const [matchTimelineOpen, setMatchTimelineOpen] = useState(false);
  const [comparisonTimelineOpen, setComparisonTimelineOpen] = useState(false);
  const [comparisonPlayerGuids, setComparisonPlayerGuids] = useState<string[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [yourTeamFilter, setYourTeamFilter] = useState("");
  const [opponentFilter, setOpponentFilter] = useState("");
  const [visibleMatches, setVisibleMatches] = useState(8);
  const [visibleByCategory, setVisibleByCategory] = useState<Record<MatchCategory, number>>({ "solo-shuffle": 5, "2v2": 5, "3v3": 5, skirmish: 5 });
  const [characters, setCharacters] = useState<TrackedCharacter[]>([]);
  const [profileName, setProfileName] = useState("");
  const [profileRealm, setProfileRealm] = useState("Defias Brotherhood");
  const [profileRegion, setProfileRegion] = useState("eu");
  const [profileBusy, setProfileBusy] = useState<number | "new" | null>(null);
  const [battleNetConfigured, setBattleNetConfigured] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<TrackedCharacter | null>(null);
  const [charactersOpen, setCharactersOpen] = useState(false);

  const loadMatches = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/matches/summaries");
      if (!response.ok) {
        throw new Error(`The backend responded with status ${response.status}`);
      }
      const data = (await response.json()) as ArenaMatch[];
      setMatches(data.sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unknown error";
      setError(`Could not load matches. ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  const loadCharacters = useCallback(async () => {
    try {
      const [profilesResponse, statusResponse] = await Promise.all([fetch("/api/characters"), fetch("/api/characters/status")]);
      if (profilesResponse.ok) setCharacters(await profilesResponse.json() as TrackedCharacter[]);
      if (statusResponse.ok) setBattleNetConfigured((await statusResponse.json() as { battleNetConfigured: boolean }).battleNetConfigured);
    } catch { /* Match history remains usable while profile sync is unavailable. */ }
  }, []);

  useEffect(() => { void loadCharacters(); }, [loadCharacters]);

  async function addCharacter(event: FormEvent) {
    event.preventDefault();
    setProfileBusy("new"); setError(null);
    try {
      const response = await fetch("/api/characters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: profileName, realm: profileRealm, region: profileRegion }) });
      if (!response.ok) throw new Error(`Could not add profile (${response.status})`);
      setProfileName(""); await loadCharacters();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Could not add profile"); }
    finally { setProfileBusy(null); }
  }

  async function refreshCharacter(id: number) {
    setProfileBusy(id); setError(null);
    try {
      const response = await fetch(`/api/characters/${id}/refresh`, { method: "POST" });
      if (!response.ok) throw new Error(`Could not sync profile (${response.status})`);
      const updated = await response.json() as TrackedCharacter;
      setSelectedCharacter((current) => current?.id === id ? updated : current);
      await loadCharacters();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Could not sync profile"); }
    finally { setProfileBusy(null); }
  }

  async function removeCharacter(id: number) {
    if (!window.confirm("Stop tracking this character?")) return;
    await fetch(`/api/characters/${id}`, { method: "DELETE" });
    await loadCharacters();
  }

  useEffect(() => {
    const handlePopState = () => {
      const matchId = Number(new URLSearchParams(window.location.search).get("match"));
      const match = matches.find((candidate) => candidate.id === matchId);
      if (match) void openMatch(match, false);
      else { setSelectedMatch(null); setMatchDetails(null); }
    };
    window.addEventListener("popstate", handlePopState);
    if (matches.length > 0 && !selectedMatch) handlePopState();
    return () => window.removeEventListener("popstate", handlePopState);
  }, [matches]);

  const filteredMatches = useMemo(() => matches.filter((match) => {
    const general = `${match.arena} ${match.matchType ?? ""} ${match.yourTeam.map(compositionText).join(" ")} ${match.opponentTeam.map(compositionText).join(" ")}`.toLowerCase();
    return general.includes(search.trim().toLowerCase()) && matchesTerms(match.yourTeam, yourTeamFilter) && matchesTerms(match.opponentTeam, opponentFilter);
  }), [matches, search, yourTeamFilter, opponentFilter]);

  const categorizedMatches = useMemo(
    () => Object.fromEntries(
      matchCategories.map((category) => [
        category.id,
        filteredMatches.filter((match) => belongsToCategory(match, category.id)),
      ]),
    ) as Record<MatchCategory, ArenaMatch[]>,
    [filteredMatches],
  );

  async function importLatestLog() {
    setImporting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/combat-log/import-arena-matches", { method: "POST" });
      if (!response.ok) {
        throw new Error(`The import failed with status ${response.status}`);
      }
      const result = (await response.json()) as ImportResponse;
      setNotice(
        result.importedMatches > 0
          ? `${result.importedMatches} new match${result.importedMatches === 1 ? " was" : "es were"} imported.`
          : `No new matches. ${result.skippedMatches} already existed.`,
      );
      await loadMatches();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unknown error");
    } finally {
      setImporting(false);
    }
  }

  async function reimportAllLogs() {
    setReimporting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/combat-log/reimport-all-arena-matches", { method: "POST" });
      if (response.status === 404) throw new Error("The backend is still running an older version. Restart ArenaParser, then try Reimport all logs again.");
      if (!response.ok) throw new Error(`The reimport failed with status ${response.status}`);
      const result = (await response.json()) as ImportResponse;
      setNotice(`${result.detectedMatches} matches refreshed from all combat logs${result.importedMatches > 0 ? `, including ${result.importedMatches} new` : ""}.`);
      await loadMatches();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unknown error");
    } finally {
      setReimporting(false);
    }
  }

  async function shutDownApplication() {
    if (!window.confirm("Shut down ArenaParser, including the database?")) return;

    setShuttingDown(true);
    setError(null);
    try {
      const response = await fetch("/api/application/shutdown", { method: "POST" });
      if (!response.ok) throw new Error(`Shutdown failed with status ${response.status}`);
      setStopped(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not shut down the application");
      setShuttingDown(false);
    }
  }

  async function openMatch(match: ArenaMatch, pushHistory = true) {
    if (pushHistory) window.history.pushState({ matchId: match.id }, "", `${window.location.pathname}?match=${match.id}`);
    setSelectedMatch(match);
    setSelectedRound(1);
    setTimelinePlayerGuid(null);
    setHealerCcTimelineOpen(false);
    setDrOverlapTimelineOpen(false);
    setMatchTimelineOpen(false);
    setComparisonTimelineOpen(false);
    setComparisonPlayerGuids([]);
    setMatchDetails(null);
    setDetailsLoading(true);
    try {
      const response = await fetch(`/api/matches/${match.id}/details`);
      if (!response.ok) throw new Error(`Could not load match details (${response.status})`);
      setMatchDetails((await response.json()) as MatchDetails);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load match details");
      setSelectedMatch(null);
    } finally {
      setDetailsLoading(false);
    }
  }

  function closeMatch() {
    if (new URLSearchParams(window.location.search).has("match")) window.history.back();
    else { setSelectedMatch(null); setMatchDetails(null); }
  }

  if (stopped) {
    return (
      <main className="stopped-screen">
        <span className="brand-mark" aria-hidden="true">AP</span>
        <p className="eyebrow">Application stopped</p>
        <h1>ArenaParser is shutting down.</h1>
        <p>You can now close this browser tab. Use the desktop shortcut to start it again.</p>
      </main>
    );
  }

  const activeRound = matchDetails?.rounds?.find((round) => round.roundNumber === selectedRound);
  const detailParticipants = activeRound?.participants ?? matchDetails?.participants ?? [];
  const detailWinningTeam = activeRound?.winningTeam ?? selectedMatch?.winningTeam;
  const detailPlayerTeam = activeRound?.playerTeam ?? selectedMatch?.playerTeam ?? null;
  const detailTimeline = timelineWithStoredDeaths(activeRound?.timeline ?? matchDetails?.timeline ?? [], detailParticipants);
  const detailDuration = activeRound?.durationSeconds ?? selectedMatch?.durationSeconds ?? 0;
  const detailDefensiveOverlaps = defensiveOverlaps(detailTimeline);
  const detailDrOverlaps = drOverlaps(detailParticipants, detailTimeline, detailDuration);
  const detailDrFollowups = detailParticipants.filter((player) => healerSpecializations.has(player.specializationName))
    .reduce((total, healer) => total + healerCcIntervals(healer, detailTimeline, detailDuration).filter((interval) => interval.drGap != null).length, 0);
  const yourTeamParticipants = detailParticipants.filter((player) => detailPlayerTeam != null && player.team === detailPlayerTeam);
  const opponentParticipants = detailParticipants.filter((player) => detailPlayerTeam == null || player.team !== detailPlayerTeam);
  const timelinePlayer = detailParticipants.find((player) => player.guid === timelinePlayerGuid) ?? null;
  const comparisonPlayers = comparisonPlayerGuids.map((guid) => detailParticipants.find((player) => player.guid === guid)).filter((player): player is ParticipantDetails => player != null);
  const detailTeams = [0, 1].map((team) => detailParticipants.filter((player) => player.team === team));
  const playerRowCount = Math.max(...detailTeams.map((team) => team.length), 0);
  const timelinePlayerRow = timelinePlayer?.team == null ? -1 : detailTeams[timelinePlayer.team]?.findIndex((player) => player.guid === timelinePlayer.guid) ?? -1;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="ArenaParser home">
          <span className="brand-mark" aria-hidden="true">AP</span>
          <span><strong>ArenaParser</strong><small>WoW arena insights</small></span>
        </a>
        <div className="topbar-actions">
          <span className="status"><i aria-hidden="true" /> Local backend</span>
          <button className={`characters-button ${charactersOpen ? "active" : ""}`} onClick={() => setCharactersOpen((open) => !open)} aria-expanded={charactersOpen} aria-controls="tracked-characters">
            Characters <span>{characters.length}</span>
          </button>
          <button className="shutdown-button" onClick={shutDownApplication} disabled={shuttingDown}>
            {shuttingDown ? "Shutting down…" : "Shut down"}
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Arena match history</h1>
        </div>
        <div className="hero-actions">
          <button className="primary-button" onClick={importLatestLog} disabled={importing}>
            {importing ? "Importing…" : "Import latest log"}
          </button>
          <button className="secondary-button" onClick={reimportAllLogs} disabled={importing || reimporting} title="Refresh existing matches from every WoWCombatLog file">
            {reimporting ? "Reimporting…" : "Reimport all logs"}
          </button>
          <button className="secondary-button" onClick={() => void loadMatches()} disabled={loading}>Refresh</button>
        </div>
      </section>

      {(notice || error) && <div className={`message ${error ? "error" : "success"}`} role="status">{error ?? notice}</div>}

      {charactersOpen && <section className="profiles-panel" id="tracked-characters">
        <div className="section-heading">
          <div><p className="eyebrow">Battle.net profiles</p><h2>Tracked characters</h2></div>
          <span>{battleNetConfigured ? "Sync enabled" : "Add API credentials to sync"}</span>
        </div>
        <div className="profile-grid">
          {characters.map((character) => <article className="profile-card clickable" key={character.id} role="button" tabIndex={0} onClick={() => setSelectedCharacter(character)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedCharacter(character); }}>
            {character.avatarUrl ? <img src={character.avatarUrl} alt="" /> : <span className="profile-avatar">{character.name.slice(0, 2).toUpperCase()}</span>}
            <div><strong>{character.name}</strong><small>{character.realmSlug} · {character.region.toUpperCase()}</small><p>{[character.activeSpecialization, character.characterClass].filter(Boolean).join(" ") || "Profile not synced"}{character.itemLevel ? ` · ${character.itemLevel} ilvl` : ""}</p>{character.syncError && <em>{character.syncError}</em>}</div>
            <div className="profile-actions"><button onClick={(event) => { event.stopPropagation(); void refreshCharacter(character.id); }} disabled={profileBusy !== null || !battleNetConfigured}>{profileBusy === character.id ? "Syncing…" : "Sync"}</button><button onClick={(event) => { event.stopPropagation(); void removeCharacter(character.id); }} aria-label={`Remove ${character.name}`}>×</button></div>
          </article>)}
        </div>
        <form className="profile-form" onSubmit={addCharacter}>
          <label><span>Character</span><input required value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Character name" /></label>
          <label><span>Realm</span><input required value={profileRealm} onChange={(event) => setProfileRealm(event.target.value)} /></label>
          <label><span>Region</span><select value={profileRegion} onChange={(event) => setProfileRegion(event.target.value)}><option value="eu">EU</option><option value="us">US</option><option value="kr">KR</option><option value="tw">TW</option></select></label>
          <button className="secondary-button" disabled={profileBusy !== null}>{profileBusy === "new" ? "Adding…" : "Add profile"}</button>
        </form>
      </section>}

      <section className="rating-modes" aria-label="Rating history">
        {(["2v2", "3v3", "solo-shuffle"] as MatchCategory[]).map((category) => {
          const title = category === "solo-shuffle" ? "Solo Shuffle" : category;
          return <section className="rating-mode" key={category}><h2>{title}</h2><MmrChart title="Your team's MMR" matches={matches.filter((match) => belongsToCategory(match, category))} /></section>;
        })}
      </section>

      <nav className="category-nav" aria-label="Match history categories">
        <a href="#recent-matches"><strong>{filteredMatches.length}</strong><span>All matches</span></a>
        {matchCategories.map((category) => (
          <a href={`#${category.id}`} key={category.id}>
            <strong>{categorizedMatches[category.id].length}</strong><span>{category.title}</span>
          </a>
        ))}
      </nav>

      <section className="matches-panel" id="recent-matches">
        <div className="section-heading">
          <div><p className="eyebrow">All arena modes</p><h2>Recent matches</h2></div>
          <span>{Math.min(filteredMatches.length, visibleMatches)} of {filteredMatches.length} matches</span>
        </div>

        <section className="match-filters" aria-label="Filter matches">
          <label className="search-field"><span>Search all matches</span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setVisibleMatches(8); }} placeholder="Search warrior, discipline, Nagrand…" /></label>
          <label><span>Your team</span><input value={yourTeamFilter} onChange={(event) => { setYourTeamFilter(event.target.value); setVisibleMatches(8); }} placeholder="e.g. restoration, warrior" /></label>
          <label><span>Opponent team</span><input value={opponentFilter} onChange={(event) => { setOpponentFilter(event.target.value); setVisibleMatches(8); }} placeholder="e.g. discipline, rogue" /></label>
          <button className="clear-filters" onClick={() => { setSearch(""); setYourTeamFilter(""); setOpponentFilter(""); setVisibleMatches(8); }}>Clear</button>
          <p>Separate multiple composition requirements with commas. Every term must occur in that team.</p>
        </section>

        {loading ? <div className="empty-state">Loading matches…</div> : filteredMatches.length === 0 ? (
          <div className="empty-state"><strong>No matching games</strong><p>Try removing one of the filters.</p></div>
        ) : <><MatchList matches={filteredMatches.slice(0, visibleMatches)} emptyMessage="Import your latest combat log to get started." onSelect={openMatch} />{visibleMatches < filteredMatches.length && <button className="load-more" onClick={() => setVisibleMatches((count) => count + 8)}>Load more matches</button>}</>}
      </section>

      <div className="category-sections">
        {matchCategories.map((category) => {
          const categoryMatches = categorizedMatches[category.id];
          return (
            <section className="matches-panel category-section" id={category.id} key={category.id}>
              <div className="section-heading">
                <div><p className="eyebrow">{category.description}</p><h2>{category.title}</h2></div>
                <span>{categoryMatches.length} matches</span>
              </div>
              <MatchList
                matches={categoryMatches.slice(0, visibleByCategory[category.id])}
                emptyMessage={`Your recent ${category.title} matches will appear here.`}
                onSelect={openMatch}
              />
              {visibleByCategory[category.id] < categoryMatches.length && <button className="load-more" onClick={() => setVisibleByCategory((counts) => ({ ...counts, [category.id]: counts[category.id] + 5 }))}>Load more {category.title} matches</button>}
            </section>
          );
        })}
      </div>

      {selectedMatch && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeMatch}>
          <section className="match-detail" role="dialog" aria-modal="true" aria-labelledby="match-detail-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="detail-header">
              <div>
                <span className={`result-badge ${selectedMatch.result.toLowerCase()}`}>{resultLabel(selectedMatch)}</span>
                <h2 id="match-detail-title">{selectedMatch.arena}</h2>
                <p>{selectedMatch.matchType ?? "Unknown mode"} · {formatDate(selectedMatch.startedAt)} · {formatDuration(selectedMatch.durationSeconds)}</p>
              </div>
              <button className="close-button" onClick={closeMatch} aria-label="Close match details">×</button>
            </header>

            {detailsLoading ? <div className="detail-loading">Loading combat statistics…</div> : matchDetails && (
              <>
                {matchDetails.rounds?.length > 0 && (
                  <nav className="round-tabs" aria-label="Solo Shuffle rounds">
                    {matchDetails.rounds.map((round) => (
                      <button
                        className={`${round.result.toLowerCase()} ${selectedRound === round.roundNumber ? "active" : ""}`}
                        key={round.roundNumber}
                        onClick={() => { setSelectedRound(round.roundNumber); setTimelinePlayerGuid(null); setComparisonPlayerGuids([]); }}
                      >
                        <span>Round {round.roundNumber}</span>
                        <strong>{round.result}</strong>
                      </button>
                    ))}
                  </nav>
                )}
                <section className="timeline-controls comparison-controls">
                  <button className={`timeline-toggle ${comparisonTimelineOpen ? "active" : ""}`} onClick={() => setComparisonTimelineOpen((open) => !open)} aria-expanded={comparisonTimelineOpen}>
                    <span><small>Optional comparison</small><strong>Compare player timelines</strong></span><span className="timeline-toggle-status">{detailDefensiveOverlaps.length > 0 && <em className="mistake-badge">! {detailDefensiveOverlaps.length}</em>}<b>{comparisonTimelineOpen ? "Hide" : "Show"}</b></span>
                  </button>
                  {comparisonTimelineOpen && <>
                    <div className="comparison-player-picker" role="group" aria-label="Characters to compare">
                      {[{ title: "Your team", players: yourTeamParticipants, className: "yours" }, { title: "Opponent team", players: opponentParticipants, className: "enemy" }].map((group) => <section className={`comparison-team-group ${group.className}`} key={group.title}>
                        <header><span>{group.title}</span><b>{group.players.length}</b></header>
                        <div>{group.players.map((player) => <label className={comparisonPlayerGuids.includes(player.guid) ? "selected" : ""} key={player.guid}>
                          <input type="checkbox" checked={comparisonPlayerGuids.includes(player.guid)} onChange={() => setComparisonPlayerGuids((current) => current.includes(player.guid) ? current.filter((guid) => guid !== player.guid) : [...current, player.guid])} />
                          <span><strong>{player.name}</strong><small>{player.specializationName} {player.className}</small></span>
                        </label>)}</div>
                      </section>)}
                    </div>
                    <DefensiveOverlapWarnings overlaps={detailDefensiveOverlaps} />
                    <ComparisonTimeline players={comparisonPlayers} events={detailTimeline} duration={detailDuration} participants={detailParticipants} playerTeam={detailPlayerTeam} />
                  </>}
                </section>
                <section className="timeline-controls cc-controls">
                  <button className={`timeline-toggle ${healerCcTimelineOpen ? "active" : ""}`} onClick={() => setHealerCcTimelineOpen((open) => !open)} aria-expanded={healerCcTimelineOpen}>
                    <span><small>Healer crowd control</small><strong>CC/chains on healers</strong></span><span className="timeline-toggle-status">{detailDrFollowups > 0 && <em className="mistake-badge">! {detailDrFollowups}</em>}<b>{healerCcTimelineOpen ? "Hide" : "Show"}</b></span>
                  </button>
                  {healerCcTimelineOpen && <HealerCcTimeline events={detailTimeline} duration={detailDuration} participants={detailParticipants} playerTeam={detailPlayerTeam} />}
                </section>
                <section className="timeline-controls dr-overlap-controls">
                  <button className={`timeline-toggle ${drOverlapTimelineOpen ? "active" : ""}`} onClick={() => setDrOverlapTimelineOpen((open) => !open)} aria-expanded={drOverlapTimelineOpen}>
                    <span><small>Repeated crowd control</small><strong>DR overlap timeline</strong></span><span className="timeline-toggle-status"><em className={`mistake-badge ${detailDrOverlaps.length === 0 ? "clear" : ""}`}>{detailDrOverlaps.length > 0 ? `! ${detailDrOverlaps.length}` : "0 issues"}</em><b>{drOverlapTimelineOpen ? "Hide" : "Show"}</b></span>
                  </button>
                  {drOverlapTimelineOpen && <DrOverlapTimeline overlaps={detailDrOverlaps} duration={detailDuration} playerTeam={detailPlayerTeam} />}
                </section>
                <section className="timeline-controls match-timeline-controls">
                  <button className={`timeline-toggle ${matchTimelineOpen ? "active" : ""}`} onClick={() => setMatchTimelineOpen((open) => !open)} aria-expanded={matchTimelineOpen}>
                    <span><small>All players</small><strong>Match cooldown timeline</strong></span><span className="timeline-toggle-status">{detailDefensiveOverlaps.length > 0 && <em className="mistake-badge">! {detailDefensiveOverlaps.length}</em>}<b>{matchTimelineOpen ? "Hide" : "Show"}</b></span>
                  </button>
                  {matchTimelineOpen && <><DefensiveOverlapWarnings overlaps={detailDefensiveOverlaps} /><CooldownTimeline events={deduplicateTimelineEvents(detailTimeline)} relatedEvents={detailTimeline} duration={detailDuration} playerTeam={detailPlayerTeam} participants={detailParticipants} /></>}
                </section>
                <div className="detail-summary">
                  <div><span>Players</span><strong>{detailParticipants.length}</strong></div>
                  <div><span>Total damage</span><strong>{formatNumber(detailParticipants.reduce((sum, player) => sum + player.damage, 0))}</strong></div>
                  <div><span>Total healing</span><strong>{formatNumber(detailParticipants.reduce((sum, player) => sum + player.healing, 0))}</strong></div>
                  <div><span>Damage taken</span><strong>{formatNumber(detailParticipants.reduce((sum, player) => sum + player.damageTaken, 0))}</strong></div>
                </div>

                <div className="teams-grid">
                  {[0, 1].map((team) => <div className="team-heading" key={`heading-${team}`}><h3>{team === detailPlayerTeam ? "Your team" : `Team ${team + 1}`}</h3><span>{team === detailWinningTeam ? "Winner" : ""}</span></div>)}
                  {Array.from({ length: playerRowCount }, (_, rowIndex) => (
                    <div className="team-row" key={`row-${rowIndex}`}>
                      {timelinePlayer && timelinePlayerRow === rowIndex && (
                        <div className="full-player-timeline">
                          <button className="close-player-timeline" onClick={() => setTimelinePlayerGuid(null)} aria-label={`Close ${timelinePlayer.name}'s spell timeline`}>×</button>
                          <PlayerTimeline player={timelinePlayer} events={detailTimeline} duration={detailDuration} participants={detailParticipants} />
                        </div>
                      )}
                      {[0, 1].map((team) => detailTeams[team][rowIndex]
                        ? <PlayerCard key={detailTeams[team][rowIndex].guid} player={detailTeams[team][rowIndex]} timelineOpen={timelinePlayerGuid === detailTeams[team][rowIndex].guid} onToggleTimeline={() => setTimelinePlayerGuid((current) => current === detailTeams[team][rowIndex].guid ? null : detailTeams[team][rowIndex].guid)} />
                        : <div className="player-card-placeholder" key={`empty-${team}-${rowIndex}`} aria-hidden="true" />
                      )}
                    </div>
                  ))}
                </div>

              </>
            )}
          </section>
        </div>
      )}
      {selectedCharacter && <ProfileDetails character={selectedCharacter} onClose={() => setSelectedCharacter(null)} onSync={() => void refreshCharacter(selectedCharacter.id)} syncing={profileBusy === selectedCharacter.id} />}
    </main>
  );
}

export default App;
