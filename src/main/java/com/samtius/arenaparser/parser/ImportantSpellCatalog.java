package com.samtius.arenaparser.parser;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/** Midnight 12.1 player-spell flags, generated from the client DB2 spell attributes. */
public final class ImportantSpellCatalog {
    public static final String VERSION = "Midnight 12.1";

    private static final Set<Long> IMPORTANT = ids("1022,102342,102543,102558,102560,1044,104773,106951,107574,108271,108280,109304,110909,114051,114052,115203,115310,116849,118,118038,120954,121471,1214780,1216848,1217605,1217989,1219480,1227373,1229474,1229510,1230289,1230302,1231871,1232221,1232760,1233398,1236574,1238147,1238158,1238294,1238392,1239874,1243852,1243854,1245752,1246541,1246664,1246918,1246965,12472,1249017,1249265,1249639,1249796,1250646,1251331,1251361,1251390,1251392,1251583,1251703,1251789,1252204,1252436,1252952,1254088,1254294,1255156,1255377,1255743,1256008,1256027,1256093,1256174,1256276,1256358,1256388,1256533,1257126,1257984,1258514,1258681,1258810,1258811,1258997,1260197,1260742,1260831,1261287,1261329,1261559,1261704,1261758,1262075,1262250,1262523,1262525,1262526,1262776,1263292,1263601,1263741,1263775,1263970,1264106,1264114,1264693,1266104,1267274,1270189,1270250,1270294,1270766,1270852,1271074,1271385,1271479,1271678,1272265,1275056,1275059,1277341,1278156,1278893,1280088,1280958,1282138,1282249,1282415,1282416,1282665,1282722,1284095,1284932,1284934,1285978,1286142,1286143,1286276,1293726,1294563,1295237,1295243,132578,134536,134789,13750,137639,141396,141401,141558,142756,142777,142778,142779,142780,142795,152953,184364,185422,186265,187827,190319,191427,192249,19236,194223,194249,198067,198144,198589,199448,204018,204021,205180,207771,212295,212800,216331,22812,228260,231895,237945,237947,237952,242733,243435,248831,264735,265187,266779,275699,288613,297850,305395,31224,31850,31884,323538,326450,33206,335235,342246,350101,350922,351119,355057,355139,355934,356407,357170,357260,357404,358131,359844,360194,360952,361175,363916,365350,365362,367679,375087,377362,377572,378441,378464,383410,387278,388392,388615,388862,389539,389654,389660,389722,390414,391109,395267,403876,408558,410358,414658,414944,423051,424419,424773,427356,432967,433841,434802,442210,443069,444743,446657,448248,449734,451026,452099,454351,454373,45438,461796,462508,466772,468966,472736,473663,473794,47585,47788,48707,48792,49028,498,50322,50334,51271,51533,5277,53480,55233,55342,642,64843,6940,79140,81549,8178,86659,871");
    private static final Set<Long> DEFENSIVE = ids("498,642,871,1022,6940,19236,22812,31224,31850,33206,45438,47585,47788,48707,48792,50322,53480,55233,81549,86659,102342,104773,108271,115203,116849,118038,120954,184364,186265,199448,204018,207771,212800,243435,264735,342246,357170,363916,414658");
    private static final Set<Long> PVP_DEFENSIVE = ids("136,498,642,871,1022,1044,1966,5277,5384,6940,11327,12975,15286,19236,22812,22842,31821,31850,33206,45182,45438,47536,47585,47788,48792,50334,53480,54216,55233,58984,61336,64843,65116,81256,81782,86659,97463,102342,104773,108271,108281,108416,110909,110960,113862,114052,115176,116849,118038,118337,120954,122278,122783,125174,132578,145629,147833,155835,157128,184364,184662,186265,187827,194679,194844,196555,197721,197862,198065,198111,199448,199450,199545,200183,200851,201633,202162,202748,204018,205629,206803,207495,207498,209426,209584,209997,210256,210294,211336,212641,212800,213664,213871,215769,219809,227847,228050,232707,236321,247563,260881,273104,289655,305395,305497,320224,323524,325174,328530,329543,330752,333889,342246,345231,354610,357170,357210,359816,362486,363522,363916,370960,373447,374348,377362,378078,378441,378464,386208,389774,394112,403876,408558,409293");
    private static final Set<Long> CROWD_CONTROL = ids("99,118,122,339,408,605,710,853,1098,1330,1513,1776,1833,2094,2637,3355,5211,5246,5484,6358,6770,6789,8122,9484,10326,15487,20066,20549,22703,24394,28271,28272,30283,31661,33395,33786,45334,47476,51514,61025,61305,61721,61780,64044,64695,77505,81261,82691,87204,89766,91797,91800,102359,105421,105771,107079,114404,115078,116706,117405,117526,118345,118699,118905,119381,126819,127797,132168,132169,157997,161353,161354,161355,161372,162480,163505,170855,179057,190925,196364,197214,198909,199042,199085,200196,200200,202244,202274,202346,203123,203337,204080,204085,204490,205369,205630,207167,207685,207777,208618,209749,210141,210873,211004,211010,211015,211881,212183,212638,213491,213688,213691,217832,221527,221562,226943,228600,233395,233759,236077,236273,255723,255941,269352,277778,277784,277787,277792,285515,287254,287712,305485,309328,316593,316595,324263,324382,331866,332423,354051,355689,356356,356567,356723,356727,356738,357021,358259,358861,360806,370970,372245,376080,377048,378760,383121,385149,388673,389831,391622,393456,407031,407032");
    private static final Set<String> DEFENSIVE_NAMES = Set.of(
            "Ice Block", "Alter Time", "Greater Invisibility", "Dispersion", "Pain Suppression", "Desperate Prayer", "Fade",
            "Barkskin", "Survival Instincts", "Frenzied Regeneration", "Ironbark", "Divine Shield", "Blessing of Protection",
            "Blessing of Spellwarding", "Shield of Vengeance", "Ardent Defender", "Guardian of Ancient Kings", "Divine Protection",
            "Die by the Sword", "Shield Wall", "Rallying Cry", "Enraged Regeneration", "Spell Reflection", "Evasion", "Cloak of Shadows",
            "Vanish", "Feint", "Fortifying Brew", "Touch of Karma", "Dampen Harm", "Diffuse Magic", "Life Cocoon", "Astral Shift",
            "Spirit Link Totem", "Healing Tide Totem", "Aspect of the Turtle", "Survival of the Fittest", "Exhilaration", "Blur", "Darkness",
            "Netherwalk", "Unending Resolve", "Dark Pact", "Anti-Magic Shell", "Icebound Fortitude", "Lichborne", "Death Pact",
            "Obsidian Scales", "Renewing Blaze", "Time Dilation", "Emerald Communion", "Zephyr", "Feign Death", "Gladiator's Medallion"
    );
    private static final Set<String> OFFENSIVE_NAMES = Set.of(
            "Zenith", "Combustion", "Icy Veins", "Arcane Surge", "Voidform", "Dark Ascension", "Power Infusion", "Celestial Alignment",
            "Incarnation: Chosen of Elune", "Incarnation: Avatar of Ashamane", "Avenging Wrath", "Crusade", "Recklessness", "Avatar",
            "Bladestorm", "Shadow Blades", "Deathmark", "Adrenaline Rush", "Symbols of Death", "Shadow Dance", "Invoke Xuen, the White Tiger",
            "Storm, Earth, and Fire", "Serenity", "Ascendance", "Doom Winds", "Feral Spirit", "Bestial Wrath", "Trueshot", "Coordinated Assault",
            "Metamorphosis", "The Hunt", "Summon Infernal", "Summon Demonic Tyrant", "Dark Soul: Instability", "Pillar of Frost", "Apocalypse",
            "Army of the Dead", "Dragonrage", "Tip the Scales", "Deep Breath", "Breath of Eons"
    );
    private static final Set<String> CROWD_CONTROL_NAMES = Set.of(
            "Cyclone", "Polymorph", "Fear", "Psychic Scream", "Hammer of Justice", "Repentance", "Blind", "Sap", "Kidney Shot", "Cheap Shot",
            "Gouge", "Leg Sweep", "Paralysis", "Hex", "Capacitor Totem", "Freezing Trap", "Intimidation", "Scatter Shot", "Imprison",
            "Mortal Coil", "Shadowfury", "Axe Toss", "Asphyxiate", "Blinding Sleet", "Mind Freeze", "Sleep Walk", "Quell", "Maim",
            "Incapacitating Roar", "Mighty Bash", "Storm Bolt", "Intimidating Shout", "Dragon's Breath", "Frost Nova"
    );

    private ImportantSpellCatalog() { }

    public static boolean isImportant(long spellId) {
        if (spellId == 157128) return false; // Saved by the Light is a frequent passive proc, not a useful timeline cooldown.
        return spellId == 1249625 || isGladiatorsMedallion(spellId) || IMPORTANT.contains(spellId) || PVP_DEFENSIVE.contains(spellId) || CROWD_CONTROL.contains(spellId);
    }
    public static boolean isImportant(long spellId, String spellName) {
        return isImportant(spellId) || DEFENSIVE_NAMES.contains(spellName) || OFFENSIVE_NAMES.contains(spellName) || CROWD_CONTROL_NAMES.contains(spellName);
    }
    public static String category(long spellId) {
        if (isGladiatorsMedallion(spellId) || DEFENSIVE.contains(spellId) || PVP_DEFENSIVE.contains(spellId)) return "DEFENSIVE";
        if (CROWD_CONTROL.contains(spellId)) return "CROWD_CONTROL";
        return "OFFENSIVE";
    }
    public static String category(long spellId, String spellName) {
        if (DEFENSIVE_NAMES.contains(spellName)) return "DEFENSIVE";
        if (CROWD_CONTROL_NAMES.contains(spellName)) return "CROWD_CONTROL";
        if (OFFENSIVE_NAMES.contains(spellName)) return "OFFENSIVE";
        return category(spellId);
    }

    private static boolean isGladiatorsMedallion(long spellId) {
        return spellId == 336126 || spellId == 208683 || spellId == 42292;
    }

    public static java.util.List<CatalogSpell> namedSpells() {
        var spells = new java.util.ArrayList<CatalogSpell>();
        DEFENSIVE_NAMES.forEach(name -> spells.add(new CatalogSpell(name, "DEFENSIVE")));
        OFFENSIVE_NAMES.forEach(name -> spells.add(new CatalogSpell(name, "OFFENSIVE")));
        CROWD_CONTROL_NAMES.forEach(name -> spells.add(new CatalogSpell(name, "CROWD_CONTROL")));
        return spells.stream().sorted(java.util.Comparator.comparing(CatalogSpell::category).thenComparing(CatalogSpell::name)).toList();
    }

    public record CatalogSpell(String name, String category) { }

    private static Set<Long> ids(String values) {
        return Arrays.stream(values.split(",")).map(Long::parseLong).collect(Collectors.toUnmodifiableSet());
    }
}
