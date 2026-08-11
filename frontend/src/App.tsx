import { useCallback, useEffect, useMemo, useState } from "react";

type MatchResult = "WIN" | "LOSS" | "UNKNOWN";

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
}

interface ImportResponse {
  detectedMatches: number;
  importedMatches: number;
  skippedMatches: number;
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

function App() {
  const [matches, setMatches] = useState<ArenaMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [shuttingDown, setShuttingDown] = useState(false);
  const [stopped, setStopped] = useState(false);
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
          <p className="eyebrow">Match overview</p>
          <h1>Your arena data,<br />without distractions.</h1>
          <p className="hero-copy">Import the latest combat log and track your match results.</p>
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

      <section className="matches-panel">
        <div className="section-heading">
          <div><p className="eyebrow">History</p><h2>Recent matches</h2></div>
          <span>{matches.length} matches</span>
        </div>

        {loading ? <div className="empty-state">Loading matches…</div> : matches.length === 0 ? (
          <div className="empty-state"><strong>No matches yet</strong><p>Import your latest combat log to get started.</p></div>
        ) : (
          <div className="match-list">
            <div className="match-row table-header" aria-hidden="true"><span>Result</span><span>Arena</span><span>Type</span><span>Date</span><span>Duration</span></div>
            {matches.map((match) => (
              <article className="match-row" key={match.id}>
                <span className={`result-badge ${match.result.toLowerCase()}`}>{match.result}</span>
                <span className="arena-name"><strong>{match.arena}</strong><small>Instance {match.instanceId ?? "–"}</small></span>
                <span data-label="Type">{match.matchType ?? "Unknown"}</span>
                <span data-label="Date">{formatDate(match.startedAt)}</span>
                <span data-label="Duration" className="duration">{formatDuration(match.durationSeconds)}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
