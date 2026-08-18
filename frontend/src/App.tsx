import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { ArenaMatch, MatchCategory, MatchDetails, ParticipantDetails, TrackedCharacter } from "./types";
import { healerSpecializations, matchCategories } from "./types";
import { ccIntervalsFor, deduplicateTimelineEvents, defensiveOverlaps, drOverlaps, timelineWithStoredDeaths } from "./analysis/timeline";
import { belongsToCategory, compositionText, formatDate, formatDuration, formatNumber, matchesTerms, resultLabel } from "./utils/formatting";
import { ProfileDetails } from "./components/characters/ProfileDetails";
import { MatchList, MmrChart, PlayerCard } from "./components/matches/MatchComponents";
import { ComparisonTimeline, CooldownTimeline, DefensiveOverlapWarnings, DrOverlapTimeline, HealerCcTimeline, PlayerTimeline } from "./components/timelines/Timelines";
import { fetchMatchDetails, fetchMatchSummaries, importLatestArenaMatches, reimportArenaMatches, shutdownApplication } from "./api/matches";
import { addTrackedCharacter, fetchCharacters, refreshTrackedCharacter, removeTrackedCharacter } from "./api/characters";

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
      const data = await fetchMatchSummaries();
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
      const result = await fetchCharacters();
      setCharacters(result.characters);
      setBattleNetConfigured(result.battleNetConfigured);
    } catch { /* Match history remains usable while profile sync is unavailable. */ }
  }, []);

  useEffect(() => { void loadCharacters(); }, [loadCharacters]);

  async function addCharacter(event: FormEvent) {
    event.preventDefault();
    setProfileBusy("new"); setError(null);
    try {
      await addTrackedCharacter(profileName, profileRealm, profileRegion);
      setProfileName(""); await loadCharacters();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Could not add profile"); }
    finally { setProfileBusy(null); }
  }

  async function refreshCharacter(id: number) {
    setProfileBusy(id); setError(null);
    try {
      const updated = await refreshTrackedCharacter(id);
      setSelectedCharacter((current) => current?.id === id ? updated : current);
      await loadCharacters();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Could not sync profile"); }
    finally { setProfileBusy(null); }
  }

  async function removeCharacter(id: number) {
    if (!window.confirm("Stop tracking this character?")) return;
    await removeTrackedCharacter(id);
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
      const result = await importLatestArenaMatches();
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
      const result = await reimportArenaMatches();
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
      await shutdownApplication();
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
      setMatchDetails(await fetchMatchDetails(match.id));
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
    .reduce((total, healer) => total + ccIntervalsFor(healer, detailTimeline, detailDuration).filter((interval) => interval.drGap != null).length, 0);
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
