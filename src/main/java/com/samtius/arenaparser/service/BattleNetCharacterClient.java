package com.samtius.arenaparser.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

@Component
public class BattleNetCharacterClient {
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final String clientId;
    private final String clientSecret;
    private volatile String cachedToken;
    private volatile Instant tokenExpiresAt = Instant.EPOCH;

    public BattleNetCharacterClient(ObjectMapper objectMapper,
            @Value("${arenaparser.battlenet.client-id:}") String clientId,
            @Value("${arenaparser.battlenet.client-secret:}") String clientSecret) {
        this.objectMapper = objectMapper;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    public boolean isConfigured() { return !clientId.isBlank() && !clientSecret.isBlank(); }

    public CharacterData fetch(String region, String realmSlug, String characterName) throws Exception {
        if (!isConfigured()) throw new IllegalStateException("Battle.net credentials are not configured in .env");
        var token = accessToken();
        var base = "https://" + region + ".api.blizzard.com/profile/wow/character/" + realmSlug + "/" + characterName.toLowerCase();
        var query = "?namespace=profile-" + region + "&locale=" + locale(region);
        var profile = get(base + query, token);
        var equipment = get(base + "/equipment" + query, token);
        var specializations = get(base + "/specializations" + query, token);
        JsonNode media;
        try { media = get(base + "/character-media" + query, token); }
        catch (Exception ignored) { media = objectMapper.createObjectNode(); }
        return new CharacterData(profile, equipment, specializations, media);
    }

    public String mediaUrl(String region, String type, long id) throws Exception {
        if (!type.equals("item") && !type.equals("spell")) throw new IllegalArgumentException("Unsupported media type");
        var media = get("https://" + region + ".api.blizzard.com/data/wow/media/" + type + "/" + id
                + "?namespace=static-" + region + "&locale=" + locale(region), accessToken());
        for (var asset : media.path("assets")) if ("icon".equals(asset.path("key").asText())) return asset.path("value").asText();
        throw new IllegalStateException("Battle.net did not return an icon");
    }

    private synchronized String accessToken() throws Exception {
        if (cachedToken != null && Instant.now().isBefore(tokenExpiresAt)) return cachedToken;
        var basic = Base64.getEncoder().encodeToString((clientId + ":" + clientSecret).getBytes(StandardCharsets.UTF_8));
        var request = HttpRequest.newBuilder(URI.create("https://oauth.battle.net/token"))
                .timeout(Duration.ofSeconds(15)).header("Authorization", "Basic " + basic)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString("grant_type=client_credentials")).build();
        var response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() / 100 != 2) throw new IllegalStateException("Battle.net authentication returned " + response.statusCode());
        var tokenResponse = objectMapper.readTree(response.body());
        cachedToken = tokenResponse.path("access_token").asText();
        tokenExpiresAt = Instant.now().plusSeconds(Math.max(60, tokenResponse.path("expires_in").asLong(86_400) - 60));
        return cachedToken;
    }

    private JsonNode get(String url, String token) throws Exception {
        var request = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(15))
                .header("Authorization", "Bearer " + token).GET().build();
        var response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() / 100 != 2) throw new IllegalStateException("Battle.net returned " + response.statusCode());
        return objectMapper.readTree(response.body());
    }

    private String locale(String region) { return region.equals("us") ? "en_US" : "en_GB"; }

    public record CharacterData(JsonNode profile, JsonNode equipment, JsonNode specializations, JsonNode media) { }
}
