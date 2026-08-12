package com.samtius.arenaparser.controller;

import com.samtius.arenaparser.parser.ImportantSpellCatalog;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/spells")
public class SpellCatalogController {
    @GetMapping
    public SpellCatalogResponse catalog() {
        return new SpellCatalogResponse(ImportantSpellCatalog.VERSION, ImportantSpellCatalog.namedSpells());
    }

    @GetMapping("/resolve")
    public ResolvedSpell resolve(@RequestParam long spellId, @RequestParam(required = false) String name) {
        return new ResolvedSpell(spellId, name, ImportantSpellCatalog.isImportant(spellId, name), ImportantSpellCatalog.category(spellId, name));
    }

    public record SpellCatalogResponse(String version, List<ImportantSpellCatalog.CatalogSpell> spells) { }
    public record ResolvedSpell(long spellId, String name, boolean important, String category) { }
}
