import type { DefensiveOverlap, DrOverlap, ParticipantDetails, TimelineEvent } from "../../types";
import { healerSpecializations } from "../../types";
import { ccChains, ccIntervalsFor, deduplicateTimelineEvents, isPvpTrinket, personalTimelineEvents, timelineEventDescription, timelineEventStyle, timelineEventTeam, timelineStackIndex } from "../../analysis/timeline";
import { formatCcDuration, formatDuration } from "../../utils/formatting";
import { SpellIcon, TimelineEventIcon } from "../common/GameIcons";

export function CooldownTimeline({ events, relatedEvents = events, duration, playerTeam, participants, title = "Cooldown timeline", eyebrow = "Midnight 12.1 important spells" }: { events: TimelineEvent[]; relatedEvents?: TimelineEvent[]; duration: number; playerTeam: number | null; participants: ParticipantDetails[]; title?: string; eyebrow?: string }) {
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

export function PlayerTimeline({ player, events, duration, participants }: { player: ParticipantDetails; events: TimelineEvent[]; duration: number; participants: ParticipantDetails[] }) {
  const personalEvents = personalTimelineEvents(player, events);

  return <CooldownTimeline events={personalEvents} relatedEvents={events} duration={duration} playerTeam={player.team} participants={participants} title={`${player.name}'s timeline`} eyebrow="Used and received important spells" />;
}

export function ComparisonTimeline({ players, events, duration, participants, playerTeam }: { players: ParticipantDetails[]; events: TimelineEvent[]; duration: number; participants: ParticipantDetails[]; playerTeam: number | null }) {
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

export function DefensiveOverlapWarnings({ overlaps }: { overlaps: DefensiveOverlap[] }) {
  if (overlaps.length === 0) return null;
  return <div className="timeline-warning-list">
    <strong><span>!</span> Defensive overlaps</strong>
    {overlaps.map((overlap, index) => <div className="timeline-warning-row" key={`${overlap.target}-${overlap.start}-${index}`}>
      <span className="warning-spell-icons"><SpellIcon spellId={overlap.firstSpellId} name={overlap.first} size={24} /><SpellIcon spellId={overlap.secondSpellId} name={overlap.second} size={24} /></span>
      <p><b>{overlap.target}</b> · {overlap.first} + {overlap.second}<small>{formatCcDuration(overlap.end - overlap.start)} overlap at {formatDuration(overlap.start)}</small></p>
    </div>)}
  </div>;
}

export function DrOverlapTimeline({ overlaps, duration, playerTeam }: { overlaps: DrOverlap[]; duration: number; playerTeam: number | null }) {
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

export function HealerCcTimeline({ events, duration, participants, playerTeam }: { events: TimelineEvent[]; duration: number; participants: ParticipantDetails[]; playerTeam: number | null }) {
  const healers = participants.filter((player) => healerSpecializations.has(player.specializationName));
  const windows = Array.from({ length: Math.max(1, Math.ceil(duration / 30)) }, (_, index) => ({ start: index * 30, end: index * 30 + 30 }));
  const data = new Map(healers.map((healer) => {
    const intervals = ccIntervalsFor(healer, events, duration);
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


