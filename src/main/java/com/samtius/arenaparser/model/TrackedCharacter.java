package com.samtius.arenaparser.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "tracked_characters", uniqueConstraints = @UniqueConstraint(columnNames = {"region", "realm_slug", "character_name"}))
public class TrackedCharacter {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "character_name", nullable = false) private String name;
    @Column(name = "realm_slug", nullable = false) private String realmSlug;
    @Column(nullable = false) private String region;
    private String characterClass;
    private String activeSpecialization;
    private Integer level;
    private Integer itemLevel;
    private Integer achievementPoints;
    private String avatarUrl;
    private Instant lastSyncedAt;
    private String syncError;
    @Column(columnDefinition = "text") private String equipmentJson;
    @Column(columnDefinition = "text") private String specializationsJson;

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getRealmSlug() { return realmSlug; }
    public void setRealmSlug(String realmSlug) { this.realmSlug = realmSlug; }
    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }
    public String getCharacterClass() { return characterClass; }
    public void setCharacterClass(String characterClass) { this.characterClass = characterClass; }
    public String getActiveSpecialization() { return activeSpecialization; }
    public void setActiveSpecialization(String activeSpecialization) { this.activeSpecialization = activeSpecialization; }
    public Integer getLevel() { return level; }
    public void setLevel(Integer level) { this.level = level; }
    public Integer getItemLevel() { return itemLevel; }
    public void setItemLevel(Integer itemLevel) { this.itemLevel = itemLevel; }
    public Integer getAchievementPoints() { return achievementPoints; }
    public void setAchievementPoints(Integer achievementPoints) { this.achievementPoints = achievementPoints; }
    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
    public Instant getLastSyncedAt() { return lastSyncedAt; }
    public void setLastSyncedAt(Instant lastSyncedAt) { this.lastSyncedAt = lastSyncedAt; }
    public String getSyncError() { return syncError; }
    public void setSyncError(String syncError) { this.syncError = syncError; }
    public String getEquipmentJson() { return equipmentJson; }
    public void setEquipmentJson(String equipmentJson) { this.equipmentJson = equipmentJson; }
    public String getSpecializationsJson() { return specializationsJson; }
    public void setSpecializationsJson(String specializationsJson) { this.specializationsJson = specializationsJson; }
}
