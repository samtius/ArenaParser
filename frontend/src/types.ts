export type MatchResult = "WIN" | "LOSS" | "DRAW" | "UNKNOWN";
export type MatchCategory = "solo-shuffle" | "2v2" | "3v3" | "skirmish";

export interface CompositionMember { name: string; className: string | null; specializationName: string | null; }
export interface ArenaMatch { id: number; arena: string; startedAt: string; durationSeconds: number; instanceId: number | null; matchType: string | null; playerTeam: number | null; winningTeam: number | null; result: MatchResult; playerWins: number | null; playerLosses: number | null; playerMmr: number | null; opponentMmr: number | null; yourTeam: CompositionMember[]; opponentTeam: CompositionMember[]; }
export interface ImportResponse { detectedMatches: number; importedMatches: number; skippedMatches: number; }

export interface TrackedCharacter { id: number; name: string; realmSlug: string; region: string; characterClass: string | null; activeSpecialization: string | null; level: number | null; itemLevel: number | null; achievementPoints: number | null; avatarUrl: string | null; lastSyncedAt: string | null; syncError: string | null; equipment?: CharacterEquipment | null; specializations?: CharacterSpecializations | null; }
export interface EquipmentItem { item?: { id: number }; media?: { id: number }; slot?: { type: string; name: string }; name?: string; quality?: { type: string; name: string }; level?: { value: number; display_string: string }; stats?: Array<{ type?: { name: string }; value?: number; display?: { display_string: string } }>; enchantments?: Array<{ display_string?: string; enchantment_id?: number }>; sockets?: Array<{ socket_type?: { name: string }; item?: { id: number; name: string }; display_string?: string }>; set?: { item_set?: { name?: string } }; }
export interface CharacterEquipment { equipped_items?: EquipmentItem[]; }
export interface TalentChoice { id?: number; rank?: number; tooltip?: { talent?: { name?: string; id?: number }; spell_tooltip?: { spell?: { name?: string; id?: number }; description?: string } }; }
export interface PvpTalentSlot { slot_number?: number; selected?: { talent?: { name?: string; id?: number }; spell_tooltip?: { spell?: { name?: string; id?: number }; description?: string } }; }
export interface TalentLoadout { is_active?: boolean; talent_loadout_code?: string; selected_class_talents?: TalentChoice[]; selected_spec_talents?: TalentChoice[]; selected_hero_talents?: TalentChoice[]; selected_class_talent_tree?: { name?: string; key?: { href?: string } }; selected_spec_talent_tree?: { name?: string; key?: { href?: string } }; selected_hero_talent_tree?: { name?: string; id?: number }; }
export interface SpecializationLoadout { specialization?: { name?: string; id?: number }; pvp_talent_slots?: PvpTalentSlot[]; loadouts?: TalentLoadout[]; }
export interface CharacterSpecializations { specializations?: SpecializationLoadout[]; active_specialization?: { name?: string }; active_hero_talent_tree?: { name?: string }; }
export interface TreeRank { rank?: number; tooltip?: { talent?: { name?: string }; spell_tooltip?: { spell?: { id?: number; name?: string }; description?: string } }; }
export interface TreeNode { id: number; unlocks?: number[]; locked_by?: number[]; node_type?: { type?: string }; ranks?: TreeRank[]; display_row?: number; display_col?: number; raw_position_x?: number; raw_position_y?: number; }
export interface HeroTree { id: number; name: string; hero_talent_nodes?: TreeNode[]; }
export interface TalentTreeData { name?: string; class_talent_nodes?: TreeNode[]; spec_talent_nodes?: TreeNode[]; hero_talent_trees?: HeroTree[]; }

export interface SpellStatistic { spellId: number; name: string; damage: number; healing: number; absorbs: number; damageTaken: number; casts: number; hits: number; criticals: number; overhealing: number; }
export interface UtilityAction { offsetSeconds: number; spellId: number; spell: string | null; target: string | null; affectedSpellId: number; affectedSpell: string | null; }
export interface ReceivedEvent { secondsBeforeDeath: number; type: "DAMAGE" | "HEALING"; source: string | null; spellId: number; spell: string | null; amount: number; healthAfter: number; maxHealth: number; }
export interface DeathRecap { deathNumber: number; offsetSeconds: number; receivedEvents: ReceivedEvent[]; }
export interface ParticipantDetails { guid: string; name: string; className: string; specializationName: string; team: number | null; damage: number; healing: number; absorbs: number; kills: number; deaths: number; interrupts: number; dispels: number; damageTaken: number; spells: SpellStatistic[]; interruptDetails: UtilityAction[]; dispelDetails: UtilityAction[]; deathRecaps: DeathRecap[]; }
export interface KeyEvent { offsetSeconds: number; type: string; source: string | null; target: string | null; spell: string | null; }
export interface TimelineEvent { offsetSeconds: number; spellId: number; spell: string; category: "DEFENSIVE" | "OFFENSIVE" | "CROWD_CONTROL" | "DEATH"; source: string; team: number | null; target: string | null; eventType: string; }
export interface CcInterval { start: number; end: number; spellId: number; spell: string; source: string; exactDuration: boolean; lane: number; drCategory: string; previousDrEnd: number | null; previousDrSpell: string | null; previousDrSpellId: number | null; drGap: number | null; }
export interface CcChain { start: number; end: number; totalDuration: number; exactDuration: boolean; trinket: TimelineEvent | null; }
export interface DefensiveOverlap { target: string; first: string; firstSpellId: number; second: string; secondSpellId: number; start: number; end: number; }
export interface DrOverlap { target: ParticipantDetails; first: string; firstSpellId: number; second: string; secondSpellId: number; category: string; start: number; end: number; gap: number; immune: boolean; }
export interface RoundDetails { roundNumber: number; durationSeconds: number; playerTeam: number | null; winningTeam: number | null; result: MatchResult; participants: ParticipantDetails[]; timeline: TimelineEvent[]; }
export interface MatchDetails { participants: ParticipantDetails[]; keyEvents: KeyEvent[]; rounds: RoundDetails[]; timeline: TimelineEvent[]; }

export const healerSpecializations = new Set(["Discipline", "Holy", "Restoration", "Mistweaver", "Preservation"]);
export const matchCategories: Array<{ id: MatchCategory; title: string; description: string }> = [
  { id: "solo-shuffle", title: "Solo Shuffle", description: "Recent rated solo rounds" },
  { id: "2v2", title: "2v2", description: "Recent two-player team matches" },
  { id: "3v3", title: "3v3", description: "Recent three-player team matches" },
  { id: "skirmish", title: "Arena Skirmishes", description: "Recent unranked arena matches" },
];
