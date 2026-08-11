import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

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
}

interface ImportResponse {
  detectedMatches: number;
  importedMatches: number;
  skippedMatches: number;
}

interface SpellStatistic {
  spellId: number; name: string; damage: number; healing: number; absorbs: number; damageTaken: number;
  casts: number; hits: number; criticals: number; overhealing: number;
}

interface UtilityAction { offsetSeconds: number; spell: string | null; target: string | null; affectedSpell: string | null; }
interface ReceivedEvent { secondsBeforeDeath: number; type: "DAMAGE" | "HEALING"; source: string | null; spell: string | null; amount: number; healthAfter: number; maxHealth: number; }
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

interface RoundDetails { roundNumber: number; durationSeconds: number; playerTeam: number | null; winningTeam: number | null; result: MatchResult; participants: ParticipantDetails[]; }
interface MatchDetails { participants: ParticipantDetails[]; keyEvents: KeyEvent[]; rounds: RoundDetails[]; }

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

function barStyle(value: number, maximum: number): CSSProperties {
  return { "--bar-width": `${maximum > 0 ? (value / maximum) * 60 : 0}%` } as CSSProperties;
}

function healthBarStyle(healthAfter: number, maxHealth: number): CSSProperties {
  const percentage = maxHealth > 0 ? Math.max(0, Math.min(100, (healthAfter / maxHealth) * 100)) : 0;
  return { "--bar-width": `${percentage}%` } as CSSProperties;
}

function MatchList({ matches, emptyMessage, onSelect }: { matches: ArenaMatch[]; emptyMessage: string; onSelect: (match: ArenaMatch) => void }) {
  if (matches.length === 0) {
    return <div className="empty-state compact"><strong>No matches yet</strong><p>{emptyMessage}</p></div>;
  }

  return (
    <div className="match-list">
      <div className="match-row table-header" aria-hidden="true">
        <span>Result</span><span>Arena</span><span>Type</span><span>Date</span><span>Duration</span>
      </div>
      {matches.map((match) => (
        <button className="match-row match-row-button" key={match.id} onClick={() => onSelect(match)} aria-label={`View details for ${match.arena}`}>
          <span className={`result-badge ${match.result.toLowerCase()}`}>{resultLabel(match)}</span>
          <span className="arena-name"><strong>{match.arena}</strong><small>Instance {match.instanceId ?? "–"}</small></span>
          <span data-label="Type">{match.matchType ?? "Unknown"}</span>
          <span data-label="Date">{formatDate(match.startedAt)}</span>
          <span data-label="Duration" className="duration">{formatDuration(match.durationSeconds)}</span>
        </button>
      ))}
    </div>
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
          {sorted.map((spell) => <div className={`bar-row ${metric === "healing" ? "healing-bar" : "damage-bar"}`} style={barStyle(spell[metric], maximum)} key={`${metric}-${spell.spellId}`}><span>{spell.name}</span><strong>{formatNumber(spell[metric])}</strong></div>)}
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
              <time>-{event.secondsBeforeDeath.toFixed(2)}s</time><span>{event.spell ?? event.type} <small>from {event.source ?? "Unknown"}</small></span><span className="recap-values"><strong>{event.type === "HEALING" ? "+" : "-"}{formatNumber(event.amount)}</strong><small>{formatNumber(event.healthAfter)} / {formatNumber(event.maxHealth)} HP</small></span>
            </div>
          ))}
        </div>
      ))}
    </details>
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
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadMatches = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/matches");
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

  const stats = useMemo(() => {
    const wins = matches.filter((match) => match.result === "WIN").length;
    const losses = matches.filter((match) => match.result === "LOSS").length;
    const decided = wins + losses;
    return { wins, losses, winRate: decided === 0 ? 0 : Math.round((wins / decided) * 100) };
  }, [matches]);

  const categorizedMatches = useMemo(
    () => Object.fromEntries(
      matchCategories.map((category) => [
        category.id,
        matches.filter((match) => belongsToCategory(match, category.id)),
      ]),
    ) as Record<MatchCategory, ArenaMatch[]>,
    [matches],
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

  async function openMatch(match: ArenaMatch) {
    setSelectedMatch(match);
    setSelectedRound(1);
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

      <section className="stats-grid" aria-label="Summary">
        <article className="stat-card"><span>Matches</span><strong>{matches.length}</strong><small>Total imported</small></article>
        <article className="stat-card win"><span>Wins</span><strong>{stats.wins}</strong><small>{stats.winRate}% win rate</small></article>
        <article className="stat-card loss"><span>Losses</span><strong>{stats.losses}</strong><small>Of decided matches</small></article>
      </section>

      <nav className="category-nav" aria-label="Match history categories">
        <a href="#recent-matches"><strong>{matches.length}</strong><span>All matches</span></a>
        {matchCategories.map((category) => (
          <a href={`#${category.id}`} key={category.id}>
            <strong>{categorizedMatches[category.id].length}</strong><span>{category.title}</span>
          </a>
        ))}
      </nav>

      <section className="matches-panel" id="recent-matches">
        <div className="section-heading">
          <div><p className="eyebrow">All arena modes</p><h2>Recent matches</h2></div>
          <span>{Math.min(matches.length, 8)} of {matches.length} matches</span>
        </div>

        {loading ? <div className="empty-state">Loading matches…</div> : matches.length === 0 ? (
          <div className="empty-state"><strong>No matches yet</strong><p>Import your latest combat log to get started.</p></div>
        ) : <MatchList matches={matches.slice(0, 8)} emptyMessage="Import your latest combat log to get started." onSelect={openMatch} />}
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
                matches={categoryMatches.slice(0, 5)}
                emptyMessage={`Your recent ${category.title} matches will appear here.`}
                onSelect={openMatch}
              />
            </section>
          );
        })}
      </div>

      {selectedMatch && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelectedMatch(null)}>
          <section className="match-detail" role="dialog" aria-modal="true" aria-labelledby="match-detail-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="detail-header">
              <div>
                <span className={`result-badge ${selectedMatch.result.toLowerCase()}`}>{resultLabel(selectedMatch)}</span>
                <h2 id="match-detail-title">{selectedMatch.arena}</h2>
                <p>{selectedMatch.matchType ?? "Unknown mode"} · {formatDate(selectedMatch.startedAt)} · {formatDuration(selectedMatch.durationSeconds)}</p>
              </div>
              <button className="close-button" onClick={() => setSelectedMatch(null)} aria-label="Close match details">×</button>
            </header>

            {detailsLoading ? <div className="detail-loading">Loading combat statistics…</div> : matchDetails && (
              <>
                {matchDetails.rounds?.length > 0 && (
                  <nav className="round-tabs" aria-label="Solo Shuffle rounds">
                    {matchDetails.rounds.map((round) => (
                      <button
                        className={`${round.result.toLowerCase()} ${selectedRound === round.roundNumber ? "active" : ""}`}
                        key={round.roundNumber}
                        onClick={() => setSelectedRound(round.roundNumber)}
                      >
                        <span>Round {round.roundNumber}</span>
                        <strong>{round.result}</strong>
                      </button>
                    ))}
                  </nav>
                )}
                <div className="detail-summary">
                  <div><span>Players</span><strong>{detailParticipants.length}</strong></div>
                  <div><span>Total damage</span><strong>{formatNumber(detailParticipants.reduce((sum, player) => sum + player.damage, 0))}</strong></div>
                  <div><span>Total healing</span><strong>{formatNumber(detailParticipants.reduce((sum, player) => sum + player.healing, 0))}</strong></div>
                  <div><span>Damage taken</span><strong>{formatNumber(detailParticipants.reduce((sum, player) => sum + player.damageTaken, 0))}</strong></div>
                </div>

                <div className="teams-grid">
                  {[0, 1].map((team) => (
                    <section className="team-panel" key={team}>
                      <div className="team-heading"><h3>Team {team + 1}</h3><span>{team === detailWinningTeam ? "Winner" : ""}</span></div>
                      {detailParticipants.filter((player) => player.team === team).map((player) => (
                        <article className="player-card" key={player.guid}>
                          <div className="player-heading"><span className="player-identity"><strong>{player.name}</strong><small>{player.className ?? "Unknown class"} · {player.specializationName ?? "Unknown specialization"}</small></span><span>{player.kills} K · {player.deaths} D</span></div>
                          <div className="player-metrics">
                            <span><small>Damage</small>{formatNumber(player.damage)}</span>
                            <span><small>Healing</small>{formatNumber(player.healing)}</span>
                            <span><small>Absorbs</small>{formatNumber(player.absorbs)}</span>
                            <span><small>Damage taken</small>{formatNumber(player.damageTaken)}</span>
                            <span><small>Utility</small>{player.interrupts} int · {player.dispels} disp</span>
                          </div>
                          <div className="player-breakdowns">
                            <SpellSection title="Damage" spells={player.spells} metric="damage" />
                            <SpellSection title="Healing" spells={player.spells} metric="healing" />
                            <SpellSection title="Damage taken" spells={player.spells} metric="damageTaken" />
                            <UtilitySection title="Dispels" actions={player.dispelDetails} />
                            <UtilitySection title="Interrupts" actions={player.interruptDetails} />
                            <DeathRecapSection recaps={player.deathRecaps} />
                          </div>
                        </article>
                      ))}
                    </section>
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
