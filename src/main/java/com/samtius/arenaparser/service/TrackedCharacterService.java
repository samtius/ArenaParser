package com.samtius.arenaparser.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.samtius.arenaparser.dto.CreateTrackedCharacterRequest;
import com.samtius.arenaparser.dto.TrackedCharacterResponse;
import com.samtius.arenaparser.model.TrackedCharacter;
import com.samtius.arenaparser.repository.TrackedCharacterRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
public class TrackedCharacterService {
    private final TrackedCharacterRepository repository;
    private final BattleNetCharacterClient client;
    private final ObjectMapper objectMapper;

    public TrackedCharacterService(TrackedCharacterRepository repository, BattleNetCharacterClient client, ObjectMapper objectMapper) {
        this.repository = repository; this.client = client; this.objectMapper = objectMapper;
    }

    public List<TrackedCharacterResponse> findAll() {
        return repository.findAll().stream().sorted(Comparator.comparing(TrackedCharacter::getName, String.CASE_INSENSITIVE_ORDER)).map(this::response).toList();
    }

    public TrackedCharacterResponse create(CreateTrackedCharacterRequest request) {
        var region = request.region() == null || request.region().isBlank() ? "eu" : request.region().toLowerCase(Locale.ROOT);
        var realm = slug(request.realm());
        var name = request.name().trim();
        var existing = repository.findByRegionAndRealmSlugAndNameIgnoreCase(region, realm, name);
        if (existing.isPresent()) return response(existing.get());
        var character = new TrackedCharacter();
        character.setName(name); character.setRealmSlug(realm); character.setRegion(region);
        character.setSyncError(client.isConfigured() ? "Not synced yet" : "Battle.net credentials are not configured");
        try { return response(repository.save(character)); }
        catch (DataIntegrityViolationException exception) { throw new IllegalArgumentException("That character is already tracked"); }
    }

    public TrackedCharacterResponse refresh(long id) {
        var character = repository.findById(id).orElseThrow(() -> new IllegalArgumentException("Tracked character not found"));
        try {
            var data = client.fetch(character.getRegion(), character.getRealmSlug(), character.getName());
            var profile = data.profile();
            character.setName(profile.path("name").asText(character.getName()));
            character.setCharacterClass(profile.path("character_class").path("name").asText(null));
            character.setActiveSpecialization(profile.path("active_spec").path("name").asText(null));
            character.setLevel(integer(profile, "level"));
            character.setItemLevel(integer(profile, "equipped_item_level"));
            character.setAchievementPoints(integer(profile, "achievement_points"));
            character.setEquipmentJson(objectMapper.writeValueAsString(data.equipment()));
            character.setSpecializationsJson(objectMapper.writeValueAsString(data.specializations()));
            character.setAvatarUrl(avatar(data.media()));
            character.setLastSyncedAt(Instant.now()); character.setSyncError(null);
        } catch (Exception exception) {
            character.setSyncError(exception.getMessage());
        }
        return response(repository.save(character));
    }

    public void delete(long id) { repository.deleteById(id); }
    public boolean battleNetConfigured() { return client.isConfigured(); }

    private TrackedCharacterResponse response(TrackedCharacter value) {
        return new TrackedCharacterResponse(value.getId(), value.getName(), value.getRealmSlug(), value.getRegion(),
                value.getCharacterClass(), value.getActiveSpecialization(), value.getLevel(), value.getItemLevel(),
                value.getAchievementPoints(), value.getAvatarUrl(), value.getLastSyncedAt(), value.getSyncError(),
                json(value.getEquipmentJson()), json(value.getSpecializationsJson()));
    }

    private JsonNode json(String value) {
        if (value == null) return null;
        try { return objectMapper.readTree(value); } catch (Exception ignored) { return null; }
    }
    private Integer integer(JsonNode node, String field) { return node.has(field) ? node.path(field).asInt() : null; }
    private String avatar(JsonNode media) {
        for (var asset : media.path("assets")) if ("avatar".equals(asset.path("key").asText())) return asset.path("value").asText(null);
        return null;
    }
    static String slug(String value) {
        return Normalizer.normalize(value.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }
}
