# Bordeaux Wine Quality Dashboard

Weather-based vintage quality prediction for 6 Bordeaux appellations, using the Ashenfelter model and Open-Meteo historical weather data.

## Quick start

### Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

# Windows only: install greenlet as a pre-built binary before the rest
pip install --only-binary :all: greenlet

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev        # serves on http://localhost:3000
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

Vite proxies `/api/*` to `http://localhost:8000`, so no CORS configuration is needed in development.

First time you select a region, the backend fetches ~25 years of weather data from Open-Meteo — this takes 10–30 seconds per region.

## Docker (alternative)

```bash
docker compose up --build
```

Requires Docker Desktop to be running. The SQLite database persists in a Docker volume (`wine_db`).

## Pre-warming the cache

On first use, call this endpoint once to populate all 6 regions in the background:

```bash
curl -X POST http://localhost:8000/api/populate
```

This avoids the 30-second wait on the first dashboard visit.

## API reference

| Endpoint | Description |
|---|---|
| `GET /api/regions` | List of all 6 Bordeaux regions |
| `GET /api/scores/{region}` | Ashenfelter scores 2000–present for a region |
| `GET /api/scores/{region}/{year}` | Score + raw weather variables for one year |
| `GET /api/current-season/{region}` | Partial score for the ongoing vintage |
| `POST /api/populate` | Pre-populate scores for all regions |

Available region IDs: `pauillac`, `saint-emilion`, `pomerol`, `pessac-leognan`, `margaux`, `saint-julien`

## Ashenfelter model

```
score = −12.145
      + 0.00117  × winter_rain   (Oct–Mar total precipitation, mm)
      + 0.0614   × growth_temp   (Apr–Sep mean temperature, °C)
      − 0.00386  × harvest_rain  (Aug–Sep total precipitation, mm)
```

The score is a relative index — higher means better predicted vintage quality. Known top vintages (2000, 2005, 2009, 2010, 2016, 2022) are highlighted in gold on the chart.

## Architecture

```
frontend/    React + Vite + Tailwind + Recharts  (port 3000)
backend/     FastAPI + SQLAlchemy + httpx         (port 8000)
             ↕
             Open-Meteo Historical Weather API
             SQLite (wine_quality.db)
```

## Data source

[Open-Meteo Historical Weather API](https://archive-api.open-meteo.com) — free, no API key required, ERA5 reanalysis data. Weather variables: `temperature_2m_mean`, `precipitation_sum`.
