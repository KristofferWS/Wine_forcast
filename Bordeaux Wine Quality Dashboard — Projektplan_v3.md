# Bordeaux Wine Quality Dashboard — Projektplan v3

## Beslutninger (låst)
- Vinpriser i MVP: Statisk historisk data (gratis)
- Antal châteaux i MVP: 25 (de mest kendte på tværs af 6 appellationer)
- Kortdata i MVP: OpenStreetMap via Leaflet.js
- Step 3: Multi-region udvidelse (Bourgogne, Mosel, Piemonte m.fl.)
- Step 3: Konfidensinterval på alle score
- Step 4: Ægte markpolygoner via RPG-geodata

---

## Projektbeskrivelse

En web-applikation der automatisk henter vejrdata for verdens vigtigste vinregioner,
kører vejrbaserede kvalitetsmodeller, og viser resultatet i et live dashboard med
konfidensintervaller. Brugeren navigerer fra vinregion → appellation → château → vin,
og ser prisudvikling, modelkvalitet og vejrprofil for hvert år.

---

## Arkitektur

### Teknologivalg

Frontend: React + Vite
- Recharts til grafer (score, priser, konfidensinterval)
- Leaflet.js til interaktivt kort
- Tailwind CSS til styling

Backend: Python (FastAPI)
- Open-Meteo Historical Weather API (vejrdata, gratis)
- Ashenfelter-beregninger inkl. konfidensinterval (scipy.stats)
- Wine-Searcher API-integration (Step 2)
- SQLite (MVP) → PostgreSQL med PostGIS (Step 4)

Statiske data (JSON-filer i /data/):
- region_models.json — modelkoefficienter pr. vinregion (se nedenfor)
- chateaux.json — ~25 châteaux med GPS-koordinater og metadata
- wines.json — vine pr. château med LWIN-koder
- historic_prices.json — auktionspriser for top-vine, årgange 2000-2022

---

## Datamodel: region_models.json

Nøglen til multi-region-arkitekturen. I stedet for at hardcode Bordeaux-koefficienterne
defineres alle modeller i én fil. Backend-koden er uændret — kun data ændres.

Struktur pr. region:
```json
{
  "id": "bordeaux",
  "name": "Bordeaux",
  "country": "Frankrig",
  "center": [44.9, -0.5],
  "zoom": 10,
  "model": {
    "intercept": -12.145,
    "winter_rain_coef": 0.00117,
    "growing_temp_coef": 0.0614,
    "harvest_rain_coef": -0.00386,
    "winter_months": [10, 11, 12, 1, 2, 3],
    "growing_months": [4, 5, 6, 7, 8, 9],
    "harvest_months": [8, 9],
    "r_squared": 0.83,
    "std_error": 0.21,
    "n_observations": 27,
    "source": "Ashenfelter, Ashmore & Lalonde (1995)"
  },
  "reference_vintages": {
    "exceptional": [1982, 1990, 2000, 2005, 2009, 2010, 2022],
    "poor": [1965, 1968, 1972, 1974]
  }
}
```

r_squared, std_error og n_observations bruges til at beregne konfidensinterval.

---

## Konfidensinterval — Teknisk forklaring

Dette er en af de vigtigste features i projektet, fordi det viser brugeren
hvornår modellen er pålidelig og hvornår den er usikker.

### Hvad vi beregner

For hvert forudsagt score beregnes et 95% konfidensinterval baseret på
regressionens standardfejl og antal observationer i den originale model.

Formlen (prediction interval for ny observation):
```
PI = score ± t(0.025, df=n-k-1) × SE × sqrt(1 + h)
```
hvor:
- t = t-fordelingens kritiske værdi (ca. 2.06 for 27 obs. ved 95%)
- SE = modellens standardfejl (residual standard error)
- h = leverage-faktor (hvor langt vejrdata er fra historisk gennemsnit)
- n = antal observationer i original model
- k = antal prædiktorer (3 for Ashenfelter)

I praksis: jo mere ekstremt vejret er (f.eks. 2022 med usædvanlig tørke),
jo bredere er konfidensintervallet — fordi vi er langt fra de data
modellen er trænet på.

### Hvad brugeren ser

I VintageScoreChart tilføjes en ErrorBar (Recharts understøtter dette nativt):
- Søjle = forudsagt score
- Whiskers = 95% konfidensinterval
- Farve-indikator: grøn (snævert CI = modellen er sikker), gul (moderat),
  rød (bredt CI = modellen er usikker — vejret er usædvanligt)

Derudover en lille badge pr. score:
  "Model R² = 0.83 — 83% af prisvariationen forklares af vejret"
  "Konfidensinterval: ±8 point (snævert — normalt vejrår)"

Dette er direkte relateret til Kahnemans pointe: vi viser ikke bare et tal,
vi viser hvornår man skal stole på det.

### Konfidensinterval for igangværende sæson

Særlig interessant: i løbet af sæsonen bliver intervallet smallere for hver
uge der går. I april er det ekstremt bredt (vi mangler sommer- og høstdata).
I oktober efter høst er det næsten endeligt. Denne "narrowing" er en unik
feature som ingen andre vindashboards viser.

---

## MVP — Fase 1: Bordeaux + konfidensinterval

Beslutninger:
- Statiske historiske priser (gratis)
- 25 châteaux på tværs af 6 appellationer
- Konfidensinterval medtages allerede i MVP (det er kun 10 ekstra linjer Python)

### Features
- Vælg Bordeaux-appellation → se liste over châteaux
- Ashenfelter-score med 95% konfidensinterval for alle år 2000-nu
- CI-farveindikator: grøn/gul/rød afhængig af intervalbredde
- Klik på château → château-specifik score (præcis GPS)
- Kortvisning med châteaux som pins
- Statisk prisliste for 7 topprodusenter, 10 årgange
- CurrentSeasonWidget med sæsonprogression og afsmalnende CI

### Backend-endpoints
```
GET /api/regions
GET /api/regions/{region}/chateaux
GET /api/chateaux/{id}
GET /api/scores/region/{region}          → inkl. ci_lower, ci_upper pr. år
GET /api/scores/chateau/{id}             → inkl. ci_lower, ci_upper pr. år
GET /api/scores/chateau/{id}/{year}      → detaljer + CI + vejrdata
GET /api/current-season/{region}         → partiel score + bredde af CI
GET /api/wines/{chateau_id}
```

Score-response inkluderer altid:
```json
{
  "year": 2022,
  "score": 94.2,
  "ci_lower": 87.1,
  "ci_upper": 101.3,
  "ci_width": 14.2,
  "ci_color": "green",
  "model_r2": 0.83,
  "weather": {
    "winter_rain_mm": 312,
    "growing_temp_c": 18.4,
    "harvest_rain_mm": 28
  }
}
```

### Frontend-komponenter
```
RegionMap              - Leaflet-kort med châteaux som pins
ChateauList            - tabel: navn, klassificering, score, CI-badge
ChateauDetail          - fuld view med alle sub-komponenter
VintageScoreChart      - søjlediagram med ErrorBar (CI whiskers)
ConfidenceIndicator    - grøn/gul/rød badge med forklaring
WeatherDetailPanel     - vejrdetaljer for valgt år
WinePriceTable         - statiske historiske priser
CurrentSeasonWidget    - progression + afsmalnende CI-visualisering
ModelInfoPanel         - "Hvad er R²?" forklaring til brugeren
```

### Estimeret arbejdstid
| Opgave | Timer |
|--------|-------|
| Kuratere data-filer (25 châteaux, vine, priser) | 3-4 t |
| Open-Meteo datahentning + Ashenfelter-beregning | 3-4 t |
| Konfidensinterval-beregning (scipy.stats) | 1-2 t |
| FastAPI backend med alle endpoints | 3-4 t |
| Leaflet kortkomponent | 2-3 t |
| React frontend + charts med ErrorBar | 4-6 t |
| CI-farveindikator og forklaringstekster | 1-2 t |
| Docker Compose + README | 1 t |
| Total | ~18-26 timer |

---

## Step 2: Live vinpriser (Wine-Searcher API)

Mål: Erstat statiske priser med live data og tilføj "model vs. marked"-analyse.

### Features
- Prisudviklingsgraf pr. vin (linjediagram, x = årgang, y = pris)
- "Model vs. marked"-view: Ashenfelter-score på y-venstre, auktionspris på y-højre
  → tydeligt hvilke årgange der er over-/undervurderet af markedet
- Critic score fra Parker, Spectator, Decanter vist ved siden af modelscore
- Sorter châteaux efter pris/kvalitet-ratio

### Nye endpoints
```
GET /api/wines/{chateau_id}/prices
GET /api/wines/{name}/{vintage}/price
GET /api/analysis/value-score/{region}   → pris vs. model for alle årgange
```

Kræver: Wine-Searcher API-nøgle (~$50/md Basic plan)
Estimeret arbejdstid: ~10-15 timer

---

## Step 3: Multi-region udvidelse

Mål: Udvid fra Bordeaux-only til verdens vigtigste vinregioner.

### Regioner og modeller

| Region | Land | Koefficienter | Kilde | Nøgle-forskel fra Bordeaux |
|--------|------|---------------|-------|---------------------------|
| Bourgogne | Frankrig | Ligner Bordeaux | Outreville (2018) | April-nedbør vigtigere (knopskydning) |
| Rhône | Frankrig | Modificeret | — | Varmere baseline, syrah-specifik |
| Mosel/Rheingau | Tyskland | Ashenfelter & Storchmann (2010) | Publiceret model | Riesling, køligt klima |
| Piemonte | Italien | Corsi & Ashenfelter (2019) | Publiceret model | Nebbiolo = lang sæson |
| Toscana | Italien | Modificeret | — | Sangiovese, tørt klima |
| Rioja | Spanien | Estimeret | — | Tempranillo, semi-arid |

Napa og Sonoma tilføjes med omvendt temperatur-fortegn (varm sommer = dårligere).

### Teknisk tilgang
1. Tilføj nye regioner til region_models.json — ingen kodeændringer i backend
2. Tilføj châteaux/domaines-data for hver region i chateaux.json
3. Frontend: tilføj verdenskort som entry-point (klik på region → gå ind i den)
4. For regioner med publicerede modeller (Mosel, Piemonte) bruges de præcise
   koefficienter. For øvrige estimeres koefficienterne fra historiske data.

### CI-udvidelse i Step 3
Regioner med publicerede modeller har kendte R² og SE-værdier → præcist CI.
For estimerede modeller vises bredere CI med note: "Estimeret model — lavere sikkerhed".
Dette er ærligt og pædagogisk: brugeren ser at Bordeaux-CI er smal (83 år data),
mens en ny region har bredere CI (færre observationer).

### Estimeret arbejdstid: ~15-20 timer

---

## Step 4: Markpolygoner (RPG-geodata)

Mål: Vis individuelle markpolygoner og beregn score pr. mark.

### Teknisk tilgang
1. Download Registre Parcellaire Graphique (RPG) fra data.gouv.fr (Gironde)
2. Konverter shapefiler til GeoJSON med ogr2ogr
3. Importer i PostGIS (PostgreSQL med geografisk udvidelse)
4. Manuel kobling: château-ID → RPG-parceller
5. Score beregnes for parcel-centroide via Open-Meteo
6. Farvekodning af marker: hvilke har haft bedst vejr i 2024?

Teknisk kompleksitet: Høj
Estimeret arbejdstid: ~20-30 timer

---

## Samlet roadmap

```
MVP                    Step 2               Step 3               Step 4
-------------------    -----------------    -----------------    ---------------
Bordeaux               Live vinpriser       Multi-region         Markpolygoner
25 châteaux            Prisudvikling        8+ vinregioner       RPG-geodata
Kortvisning            Model vs. marked     Verdenskort          PostGIS
Statiske priser        Critic scores        Region-specifik CI   Score pr. mark
Konfidensinterval      Pris/kvalitet-ratio  Estimerede modeller
~18-26 timer           ~10-15 timer         ~15-20 timer         ~20-30 timer
```

---

## Projektstruktur

```
wine-quality-dashboard/
├── backend/
│   ├── main.py
│   ├── weather.py
│   ├── ashenfelter.py          # inkl. konfidensinterval-beregning
│   ├── database.py
│   ├── wine_prices.py          (Step 2)
│   └── requirements.txt        # fastapi, uvicorn, httpx, scipy
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── RegionMap.jsx
│   │   │   ├── ChateauList.jsx
│   │   │   ├── ChateauDetail.jsx
│   │   │   ├── VintageScoreChart.jsx    # med ErrorBar (CI)
│   │   │   ├── ConfidenceIndicator.jsx  # grøn/gul/rød badge
│   │   │   ├── ModelInfoPanel.jsx       # R² forklaring
│   │   │   ├── WinePriceChart.jsx       (Step 2)
│   │   │   ├── CurrentSeasonWidget.jsx
│   │   │   └── WeatherDetailPanel.jsx
│   │   └── api/client.js
│   └── package.json
├── data/
│   ├── region_models.json       # koefficienter pr. vinregion
│   ├── chateaux.json
│   ├── wines.json
│   └── historic_prices.json
├── docker-compose.yml
└── README.md
```

---

## Brief til Claude Code (v3 — FINAL)

Kopier alt nedenfor og giv det til Claude Code:

---

Jeg vil bygge en web-applikation kaldet "Wine Quality Dashboard".

OVERORDNET ARKITEKTUR:
- Backend: Python/FastAPI i /backend/
- Frontend: React + Vite + Tailwind + Recharts + Leaflet i /frontend/
- Statiske data: JSON-filer i /data/
- Docker Compose: backend port 8000, frontend port 3000

============================================================
BACKEND
============================================================

VEJRDATA:
Brug Open-Meteo Historical Weather API:
  https://archive-api.open-meteo.com/v1/archive
  Parametre: latitude, longitude, start_date, end_date
  Variabler: temperature_2m_mean, precipitation_sum (daglig)
  Cache resultater i SQLite så vi ikke kalder API unødigt

ASHENFELTER-MODEL + KONFIDENSINTERVAL:
Implementer i ashenfelter.py:

def calculate_score(weather_data, model_config):
    winter_rain = sum nedbør for model_config["winter_months"]
    growing_temp = gennemsnit temperatur for model_config["growing_months"]
    harvest_rain = sum nedbør for model_config["harvest_months"]

    score = (model_config["intercept"]
             + model_config["winter_rain_coef"] * winter_rain
             + model_config["growing_temp_coef"] * growing_temp
             + model_config["harvest_rain_coef"] * harvest_rain)
    return score

def calculate_confidence_interval(score, weather_data, model_config, alpha=0.05):
    # 95% prediction interval
    from scipy import stats
    n = model_config["n_observations"]
    k = 3  # antal prædiktorer
    df = n - k - 1
    t_crit = stats.t.ppf(1 - alpha/2, df)
    se = model_config["std_error"]

    # Simpel leverage: hvor langt er dette vejrår fra historisk gennemsnit?
    # Brug model_config["historical_means"] og ["historical_stds"] hvis tilgængeligt
    # Ellers: leverage h = 1/n (minimal leverage, konservativt estimat)
    h = 1 / n

    margin = t_crit * se * (1 + h) ** 0.5
    ci_lower = score - margin
    ci_upper = score + margin
    ci_width = ci_upper - ci_lower

    # Farvekode: grøn < 15 point bred, gul 15-25, rød > 25
    if ci_width < 15:
        ci_color = "green"
    elif ci_width < 25:
        ci_color = "yellow"
    else:
        ci_color = "red"

    return {
        "ci_lower": round(ci_lower, 1),
        "ci_upper": round(ci_upper, 1),
        "ci_width": round(ci_width, 1),
        "ci_color": ci_color
    }

Normaliser den rå Ashenfelter-score til 0-100 skala baseret på reference_vintages
i region_models.json (exceptional årgange = ~90-100, poor = ~40-50).

ENDPOINTS:
GET /api/regions                          → liste over alle regioner fra region_models.json
GET /api/regions/{region_id}/chateaux     → châteaux i en region
GET /api/chateaux/{id}                    → detaljer om ét château
GET /api/scores/region/{region_id}        → score + CI for alle år 2000-nu
GET /api/scores/chateau/{id}              → score + CI for alle år 2000-nu (præcis GPS)
GET /api/scores/chateau/{id}/{year}       → score + CI + råt vejrdata for ét år
GET /api/current-season/{region_id}       → delvis score + CI for igangværende år
GET /api/wines/{chateau_id}               → vine med statiske priser

Alle score-responses skal inkludere:
{
  "year": 2022,
  "score": 94.2,
  "score_normalized": 94.2,
  "ci_lower": 87.1,
  "ci_upper": 101.3,
  "ci_width": 14.2,
  "ci_color": "green",
  "model_r2": 0.83,
  "model_source": "Ashenfelter, Ashmore & Lalonde (1995)",
  "weather": {
    "winter_rain_mm": 312,
    "growing_temp_c": 18.4,
    "harvest_rain_mm": 28
  }
}

============================================================
STATISKE DATA — opret disse filer i /data/
============================================================

/data/region_models.json — start med kun Bordeaux:
[{
  "id": "bordeaux",
  "name": "Bordeaux",
  "country": "Frankrig",
  "center": [44.9, -0.5],
  "zoom": 10,
  "model": {
    "intercept": -12.145,
    "winter_rain_coef": 0.00117,
    "growing_temp_coef": 0.0614,
    "harvest_rain_coef": -0.00386,
    "winter_months": [10, 11, 12, 1, 2, 3],
    "growing_months": [4, 5, 6, 7, 8, 9],
    "harvest_months": [8, 9],
    "r_squared": 0.83,
    "std_error": 0.21,
    "n_observations": 27,
    "source": "Ashenfelter, Ashmore & Lalonde (1995)"
  },
  "reference_vintages": {
    "exceptional": [1982, 1990, 2000, 2005, 2009, 2010, 2022],
    "poor": [1965, 1968, 1972, 1974]
  }
}]

/data/chateaux.json — 25 châteaux:
Pauillac (5): Lafite Rothschild (45.1972,-0.7489), Mouton Rothschild (45.2072,-0.7519),
  Latour (45.1756,-0.7475), Pichon Baron (45.1833,-0.7500), Lynch-Bages (45.2011,-0.7514)
Saint-Emilion (4): Cheval Blanc (44.9028,-0.1597), Figeac (44.9000,-0.1511),
  Angelus (44.8889,-0.1500), Pavie (44.8833,-0.1472)
Pomerol (4): Petrus (44.9167,-0.1833), Le Pin (44.9147,-0.1814),
  Lafleur (44.9153,-0.1817), Vieux Chateau Certan (44.9139,-0.1808)
Pessac-Leognan (4): Haut-Brion (44.7800,-0.6289), La Mission Haut-Brion (44.7808,-0.6275),
  Pape Clement (44.7972,-0.6106), Smith Haut Lafitte (44.7289,-0.5625)
Margaux (4): Chateau Margaux (45.0383,-0.6703), Palmer (45.0439,-0.6706),
  Rauzan-Segla (45.0422,-0.6711), Brane-Cantenac (45.0269,-0.6786)
Saint-Julien (4): Ducru-Beaucaillou (45.1169,-0.7433), Leoville Las Cases (45.1289,-0.7486),
  Leoville Barton (45.1325,-0.7511), Talbot (45.1358,-0.7458)

Felter pr. château: id, name, region_id, appellation, classification, lat, lon,
description (2 sætninger), primary_grape, founded_year

/data/wines.json — grand vin + second wine pr. château (50 vine total):
Felter: id, chateau_id, name, type (grand_vin/second_wine), lwin7, typical_blend

/data/historic_prices.json — USD/flaske for årgangene 2000, 2005, 2009, 2010, 2015, 2016, 2019, 2022
for disse vine: Lafite Rothschild, Mouton Rothschild, Latour, Petrus,
Haut-Brion, Chateau Margaux, Cheval Blanc
Brug kendte auktionspriser (eks: Petrus 2022 ca. $4500, Lafite 2022 ca. $700)

============================================================
FRONTEND
============================================================

Komponenter:

1. RegionSelector
   Dropdown eller tabs øverst. I MVP kun "Bordeaux".
   Vis kort forklaring: "Score baseret på Ashenfelter-modellen (R²=0.83)"

2. RegionMap (Leaflet + OpenStreetMap)
   Vis châteaux som farvede pins på kortet.
   Farve på pin = seneste års CI-farve (grøn/gul/rød).
   Klik på pin → åbner ChateauDetail i sidebar.

3. ChateauList
   Tabel: navn | appellation | klassificering | seneste score | CI-badge | top vin
   CI-badge: lille farvet dot med tooltip "Modelusikkerhed: lav/middel/høj"
   Klikbar række → åbner ChateauDetail

4. ChateauDetail — vises i højre panel eller modal
   a) Header: château-navn, klassificering, GPS-koordinat, primary grape
   b) VintageScoreChart:
      - Søjlediagram, x = år 2000-nu
      - Søjlehøjde = normalized score (0-100)
      - ErrorBar på hver søjle = CI (ci_lower til ci_upper)
      - Toppårgange (2000, 2005, 2009, 2010, 2016, 2022) i bordeauxrød farve
      - Andre år i gråblå
      - Klik på søjle → opdaterer WeatherDetailPanel
      - Lille tekst under graf: "R² = 0.83 | Kilde: Ashenfelter et al. 1995"
   c) ConfidenceIndicator:
      For valgt år: "Konfidensinterval: ±X point (snævert/moderat/bredt)"
      Forklaring: "Et snævert interval betyder vejret dette år ligner de år
      modellen er trænet på. Et bredt interval opstår ved usædvanligt vejr."
   d) WeatherDetailPanel:
      3 kort: Vinternedbør (mm) | Væksttemperatur (°C) | Høstnedbør (mm)
      Vis afvigelse fra historisk gennemsnit med pil op/ned
   e) WineList:
      Liste over vine med type, blend, og statiske priser (hvis tilgængeligt)

5. CurrentSeasonWidget
   Vis igangværende år (f.eks. 2025).
   Progressionslinje: "Vinter ✓ | Forår ✓ | Sommer (igangværende) | Høst ○"
   Delvis score med meget bredt CI i starten af sæsonen.
   Tekst: "CI bliver smallere jo længere sæsonen skrider frem"

6. ModelInfoPanel (collapsible)
   Hvad er Ashenfelter-modellen? (2 sætninger)
   Hvad betyder R²? "83% af prisvariationen i historiske data forklares af vejret"
   Hvad betyder konfidensintervallet? Simpel forklaring uden jargon.
   Link til original paper.

STYLING:
- Farvepalette: dyb bordeauxrød (#722F37), varm guld (#C8A951), mørk baggrund (#1a1a2e)
- Mørkt tema som standard
- Professionelt og rent — ikke farverigt

OPSAETNING:
- requirements.txt skal inkludere: fastapi, uvicorn, httpx, scipy, sqlite3 (built-in)
- docker-compose.yml: backend port 8000, frontend port 3000
- README med: installation, hvordan man kører lokalt, hvad hvert endpoint gør

START HER:
1. Opret /data/ filerne med alle statiske data
2. Byg backend og verificer at /api/scores/region/bordeaux returnerer
   fornuftige tal for 2022 (score > 90, CI grøn) og 2021 (score < 70, CI gul/rød)
3. Byg derefter frontend

---

*Projektplan version 3.0 — Maj 2026*