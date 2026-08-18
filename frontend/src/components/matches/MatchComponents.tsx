import type { CSSProperties } from "react";
import type { ArenaMatch, DeathRecap, ParticipantDetails, SpellStatistic, UtilityAction } from "../../types";
import { barStyle, compositionText, formatDate, formatDuration, formatNumber, healthBarStyle, resultLabel } from "../../utils/formatting";
import { SpellIcon } from "../common/GameIcons";

export function MatchList({ matches, emptyMessage, onSelect }: { matches: ArenaMatch[]; emptyMessage: string; onSelect: (match: ArenaMatch) => void }) {
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

export function MmrChart({ title, matches }: { title: string; matches: ArenaMatch[] }) {
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

export function PlayerCard({ player, timelineOpen, onToggleTimeline }: { player: ParticipantDetails; timelineOpen: boolean; onToggleTimeline: () => void }) {
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


