import { useEffect, useState } from "react";
import type { TalentChoice, TalentTreeData, TrackedCharacter, TreeNode } from "../../types";
import { formatDate } from "../../utils/formatting";
import { BattleNetIcon } from "../common/GameIcons";

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

export function ProfileDetails({ character, onClose, onSync, syncing }: { character: TrackedCharacter; onClose: () => void; onSync: () => void; syncing: boolean }) {
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


