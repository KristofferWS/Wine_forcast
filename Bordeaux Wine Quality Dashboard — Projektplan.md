# Bordeaux Wine Quality Dashboard — Projektplan

## Projektbeskrivelse

En web-applikation der automatisk henter vejrdata for Bordeaux-regionens vigtigste appellationer,
kører Ashenfelters vinprognosemodel (og evt. en moderniseret variant), og visualiserer resultatet
i et live dashboard. Formålet er at give vinentusiaster og investorer et datadrevet overblik over
igangværende og historiske årgangskvalitet — uden at vente på ekspertanmeldelser.

---

## Arkitektur

### Teknologivalg

**Frontend:** React + Vite
- Recharts til grafer og dashboard-komponenter
- Tailwind CSS til styling
- Ingen tung framework-overhead — passer til MVP

**Backend / Data-lag:** Python (FastAPI)
- Henter og behandler vejrdata fra Open-Meteo API
- Kører Ashenfelter-beregningerne server-side
- Cacher data lokalt (SQLite) så vi ikke hammer API'en

**Database:** SQLite (MVP) → PostgreSQL (Step 2+)
- Gemmer historiske vejrdata og beregnede scores pr. region og år

**Deployment (MVP):** Lokal kørsel / Docker Compose
- Frontend på port 3000, backend på port 8000
- Ingen cloud-afhængighed i MVP

### Datakilde

**Open-Meteo Historical Weather API** — gratis, ingen API-nøgle krævet
- Endpoint: `https://archive-api.open-meteo.com/v1/archive`
- Dækker historiske data tilbage til 1940
- Giver daglig temperatur og nedbør for præcise GPS-koordinater
- Variabler vi bruger:
  - `temperature_2m_mean` — daglig middeltemperatur
  - `precipitation_sum` — daglig nedbør i mm

### Bordeaux-regioner og koordinater

| Region           | Lat     | Lon     | Kendte châteaux |
|------------------|---------|---------|-----------------|
| Pauillac         | 45.1963 | -0.7539 | Lafite, Mouton, Latour |
| Saint-Émilion    | 44.8941 | -0.1553 | Pétrus, Cheval Blanc |
| Pomerol          | 44.9167 | -0.1833 | Pétrus, Le Pin |
| Pessac-Léognan   | 44.7761 | -0.6286 | Haut-Brion, Mission |
| Margaux          | 45.0381 | -0.6706 | Château Margaux |
| Saint-Julien     | 45.1167 | -0.7667 | Ducru-Beaucaillou |

---

## Ashenfelter-modellen (implementering)

```
Kvalitetsindeks = -12.145
  + 0.00117  × vinter_nedbør_mm       (okt–mar)
  + 0.0614   × gennemsnitlig_væksttemp_°C  (apr–sep)
  - 0.00386  × høst_nedbør_mm         (aug–sep)
```

Resultatet er et relativt indeks — jo højere, jo bedre potentiel årgang.
Vi normaliserer det mod kendte toppårgange (1982, 1990, 2000, 2005, 2010, 2022)
så brugeren ser en intuitiv skala (f.eks. 0–100 eller "Dårlig / Middel / God / Exceptionel").

---

## MVP — Fase 1

**Mål:** Fungerende proof-of-concept. Én region, historiske data, Ashenfelter-score, simpelt UI.

### Features
- Vælg region fra dropdown (de 6 appellationer)
- Vis Ashenfelter-score for alle år 2000–i dag som søjlediagram
- Fremhæv kendte toppårgange til sammenligning
- Vis de tre rå vejrvariable for valgt år (vinternedbør, væksttemp, høstnedbør)
- "Igangværende sæson"-widget: viser score for det aktuelle år baseret på data så langt

### Backend-opgaver (Python/FastAPI)
```
GET /api/regions                    → liste over regioner
GET /api/scores/{region}            → alle årgangsscore for en region
GET /api/scores/{region}/{year}     → score + vejrdetaljer for ét år
GET /api/current-season/{region}    → delvis score for igangværende år
```

### Frontend-komponenter (React)
```
<RegionSelector />       — dropdown med de 6 appellationer
<VintageScoreChart />    — søjlediagram, år på x-aksen, score på y-aksen
<CurrentSeasonWidget />  — "termometer" for igangværende sæson
<WeatherDetailPanel />   — vinter/vækst/høst-nedbør og temp for valgt år
```

### Estimeret arbejdstid (MVP)
| Opgave | Timer |
|--------|-------|
| Open-Meteo datahentning + beregning | 3–4 t |
| FastAPI backend med endpoints | 2–3 t |
| React frontend grundstruktur | 3–4 t |
| Charts og widgets | 3–4 t |
| Docker Compose setup | 1 t |
| **Total** | **~12–16 timer** |

---

## Step 2 — Udvidelser

**Mål:** Mere data, bedre model, sammenligning på tværs af regioner.

### Features
- Sammenlign alle 6 regioner i ét view (heatmap over år × regioner)
- Tilføj "moderniseret model" med ekstra variabler:
  - Frostrisikoindeks (antal dage under 0°C i april)
  - Ekstremvarme-dage (antal dage over 35°C)
  - Nedbørsvarians (ikke kun sum, men fordeling)
- Eksporter data som CSV
- Årgangskort: klik på et år og se fuldt vejrprofil
- Historisk akkuratesse: vis model-score vs. faktiske auktionspriser (Liv-ex data)

### Tekniske udvidelser
- Skift SQLite → PostgreSQL
- Tilføj baggrundsjob (cron) der opdaterer data dagligt
- API-caching med Redis

---

## Step 3 — Avanceret

**Mål:** Platformen som seriøst analyseværktøj for vininvestorer.

### Features
- Machine learning-model som supplement til Ashenfelter
  (Random Forest trænet på historiske vejr + auktionspriser)
- Prisforudsigelse: estimeret fremtidig auktionspris for unge årgange
- Notifikationer: "Årets sommervejr er på niveau med 2009" (email/push)
- Brugerkonti med gemte regioner og favoritårgange
- API-adgang for tredjeparter

### Designfase (du nævnte Google Slides)
Når MVP er valideret, laves wireframes og visuel identitet:
- Farvepalette inspireret af Bordeaux (dyb rød, guld, mørkt grønt)
- Mobile-first responsivt layout
- Mørkt tema som standard (vintema)

---

## Projektstruktur (kodebase)

```
bordeaux-dashboard/
├── backend/
│   ├── main.py                 # FastAPI app
│   ├── weather.py              # Open-Meteo API-kald
│   ├── ashenfelter.py          # Modelberegninger
│   ├── database.py             # SQLite-håndtering
│   ├── regions.py              # Regionsdefinitioner og koordinater
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── RegionSelector.jsx
│   │   │   ├── VintageScoreChart.jsx
│   │   │   ├── CurrentSeasonWidget.jsx
│   │   │   └── WeatherDetailPanel.jsx
│   │   ├── hooks/
│   │   │   └── useVintageData.js
│   │   └── api/
│   │       └── client.js
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml
└── README.md
```

---

## Brief til Claude Code

Kopier teksten nedenfor og giv den direkte til Claude Code:

---

```
Jeg vil gerne bygge en web-applikation kaldet "Bordeaux Wine Quality Dashboard".

OPGAVE: Byg en fungerende MVP med følgende:

BACKEND (Python/FastAPI):
- Opret en FastAPI-app i /backend/
- Brug Open-Meteo Historical Weather API (https://archive-api.open-meteo.com/v1/archive)
  til at hente daglig temperatur (temperature_2m_mean) og nedbør (precipitation_sum)
  for GPS-koordinater i Bordeaux-regionen
- Implementer Ashenfelter-modellen:
    score = -12.145 + (0.00117 * vinter_nedbør) + (0.0614 * vækst_temp) - (0.00386 * høst_nedbør)
  hvor:
    - vinter_nedbør = total nedbør oktober–marts (mm)
    - vækst_temp = gennemsnitlig daglig temperatur april–september (°C)
    - høst_nedbør = total nedbør august–september (mm)
- Gem beregnede scores i SQLite-database
- Eksponér disse endpoints:
    GET /api/regions
    GET /api/scores/{region}
    GET /api/scores/{region}/{year}
    GET /api/current-season/{region}

Regioner og koordinater:
  pauillac:      45.1963, -0.7539
  saint-emilion: 44.8941, -0.1553
  pomerol:       44.9167, -0.1833
  pessac-leognan: 44.7761, -0.6286
  margaux:       45.0381, -0.6706
  saint-julien:  45.1167, -0.7667

FRONTEND (React + Vite + Tailwind + Recharts):
- Opret React-app i /frontend/
- RegionSelector: dropdown med de 6 regioner
- VintageScoreChart: søjlediagram, år 2000–nu på x-aksen, Ashenfelter-score på y-aksen
  Fremhæv kendte toppårgange: 2000, 2005, 2009, 2010, 2016, 2022 med anden farve
- CurrentSeasonWidget: vis delvis score for det igangværende år med en progressionsindikator
- WeatherDetailPanel: vis de tre rå vejrvariable for et valgt år

OPSÆTNING:
- Lav en docker-compose.yml der starter backend på port 8000 og frontend på port 3000
- Lav en README.md med installationsvejledning

Start med backend og sørg for at alle endpoints virker før du bygger frontend.
Brug requirements.txt til Python-pakker: fastapi, uvicorn, httpx, sqlite3 (built-in).
```
---

*Projektplan version 1.0 — Maj 2026*