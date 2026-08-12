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
}

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

interface TimelineEvent { offsetSeconds: number; spellId: number; spell: string; category: "DEFENSIVE" | "OFFENSIVE" | "CROWD_CONTROL"; source: string; team: number | null; target: string | null; eventType: string; }
interface RoundDetails { roundNumber: number; durationSeconds: number; playerTeam: number | null; winningTeam: number | null; result: MatchResult; participants: ParticipantDetails[]; timeline: TimelineEvent[]; }
interface MatchDetails { participants: ParticipantDetails[]; keyEvents: KeyEvent[]; rounds: RoundDetails[]; timeline: TimelineEvent[]; }

const healerSpecializations = new Set(["Discipline", "Holy", "Restoration", "Mistweaver", "Preservation"]);

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
  return events.filter((event, index) => !events.slice(0, index).some((previous) =>
    previous.spellId === event.spellId &&
    previous.source === event.source &&
    Math.abs(previous.offsetSeconds - event.offsetSeconds) < 0.5
  ));
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
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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
  const rows = Array.from({ length: Math.ceil(events.length / 20) }, (_, index) => {
    const rowEvents = events.slice(index * 20, index * 20 + 20);
    const startSeconds = index === 0 ? 0 : events[index * 20 - 1].offsetSeconds;
    const endSeconds = rowEvents.length === 20
      ? rowEvents[rowEvents.length - 1].offsetSeconds
      : duration;

    return { events: rowEvents, startSeconds, endSeconds };
  });
  return (
    <section className="timeline-panel">
      <div className="timeline-heading"><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div><span>{events.length} events</span></div>
      {events.length === 0 ? <p className="timeline-empty">No tracked cooldowns were used in this match.</p> : (
        <div className="timeline-rows">
          {rows.map((row, rowIndex) => (
            <div className="timeline-track" key={rowIndex}>
              <span className="timeline-team-label team-one">{playerTeam == null ? "Team 1" : "Same team"}</span><span className="timeline-team-label team-two">{playerTeam == null ? "Team 2" : "Opponents"}</span>
              <div className="timeline-axis"><span>{formatDuration(row.startSeconds)}</span><span>{formatDuration(row.endSeconds)}</span></div>
              {row.events.map((event, index) => (
                <button className={`timeline-event ${event.category.toLowerCase()} team-${playerTeam == null ? (event.team ?? 0) : event.team === playerTeam ? 0 : 1}`} style={{ left: `${row.endSeconds > row.startSeconds ? Math.min(100, Math.max(0, ((event.offsetSeconds - row.startSeconds) / (row.endSeconds - row.startSeconds)) * 100)) : 0}%` }} key={`${event.offsetSeconds}-${event.spellId}-${index}`} data-tooltip={`${event.spell} → ${timelineTargetsLabel(event, relatedEvents, participants)}`} aria-label={`${event.spell} affected ${timelineTargetsLabel(event, relatedEvents, participants)} at ${formatDuration(event.offsetSeconds)}, used by ${event.source}`}>
                  <SpellIcon spellId={event.spellId} name={event.spell} size={32} showTitle={false} />
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PlayerTimeline({ player, events, duration, participants }: { player: ParticipantDetails; events: TimelineEvent[]; duration: number; participants: ParticipantDetails[] }) {
  const personalEvents = deduplicateTimelineEvents(events.filter((event) =>
      (event.source === player.name && (event.eventType === "SPELL_CAST_SUCCESS" || event.eventType === "SPELL_AURA_APPLIED")) ||
      (event.target === player.name && event.eventType === "SPELL_AURA_APPLIED")
    ));

  return <CooldownTimeline events={personalEvents} relatedEvents={events} duration={duration} playerTeam={player.team} participants={participants} title={`${player.name}'s timeline`} eyebrow="Used and received important spells" />;
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
  const [shuttingDown, setShuttingDown] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<ArenaMatch | null>(null);
  const [matchDetails, setMatchDetails] = useState<MatchDetails | null>(null);
  const [selectedRound, setSelectedRound] = useState(1);
  const [timelinePlayerGuid, setTimelinePlayerGuid] = useState<string | null>(null);
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
  const detailTimeline = activeRound?.timeline ?? matchDetails?.timeline ?? [];
  const detailDuration = activeRound?.durationSeconds ?? selectedMatch?.durationSeconds ?? 0;
  const timelinePlayer = detailParticipants.find((player) => player.guid === timelinePlayerGuid) ?? null;
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
          <button className="secondary-button" onClick={() => void loadMatches()} disabled={loading}>Refresh</button>
        </div>
      </section>

      {(notice || error) && <div className={`message ${error ? "error" : "success"}`} role="status">{error ?? notice}</div>}

      <section className="profiles-panel">
        <div className="section-heading">
          <div><p className="eyebrow">Battle.net profiles</p><h2>Tracked characters</h2></div>
          <span>{battleNetConfigured ? "Sync enabled" : "Add API credentials to sync"}</span>
        </div>
        <div className="profile-grid">
          {characters.map((character) => <article className="profile-card" key={character.id}>
            {character.avatarUrl ? <img src={character.avatarUrl} alt="" /> : <span className="profile-avatar">{character.name.slice(0, 2).toUpperCase()}</span>}
            <div><strong>{character.name}</strong><small>{character.realmSlug} · {character.region.toUpperCase()}</small><p>{[character.activeSpecialization, character.characterClass].filter(Boolean).join(" ") || "Profile not synced"}{character.itemLevel ? ` · ${character.itemLevel} ilvl` : ""}</p>{character.syncError && <em>{character.syncError}</em>}</div>
            <div className="profile-actions"><button onClick={() => void refreshCharacter(character.id)} disabled={profileBusy !== null || !battleNetConfigured}>{profileBusy === character.id ? "Syncing…" : "Sync"}</button><button onClick={() => void removeCharacter(character.id)} aria-label={`Remove ${character.name}`}>×</button></div>
          </article>)}
        </div>
        <form className="profile-form" onSubmit={addCharacter}>
          <label><span>Character</span><input required value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Character name" /></label>
          <label><span>Realm</span><input required value={profileRealm} onChange={(event) => setProfileRealm(event.target.value)} /></label>
          <label><span>Region</span><select value={profileRegion} onChange={(event) => setProfileRegion(event.target.value)}><option value="eu">EU</option><option value="us">US</option><option value="kr">KR</option><option value="tw">TW</option></select></label>
          <button className="secondary-button" disabled={profileBusy !== null}>{profileBusy === "new" ? "Adding…" : "Add profile"}</button>
        </form>
      </section>

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
                        onClick={() => { setSelectedRound(round.roundNumber); setTimelinePlayerGuid(null); }}
                      >
                        <span>Round {round.roundNumber}</span>
                        <strong>{round.result}</strong>
                      </button>
                    ))}
                  </nav>
                )}
                <CooldownTimeline events={deduplicateTimelineEvents(detailTimeline)} relatedEvents={detailTimeline} duration={detailDuration} playerTeam={detailPlayerTeam} participants={detailParticipants} />
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
    </main>
  );
}

export default App;
