package com.samtius.arenaparser.repository;

import com.samtius.arenaparser.model.TrackedCharacter;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface TrackedCharacterRepository extends JpaRepository<TrackedCharacter, Long> {
    Optional<TrackedCharacter> findByRegionAndRealmSlugAndNameIgnoreCase(String region, String realmSlug, String name);
}
