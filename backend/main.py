import csv
import io
import logging
from contextlib import asynccontextmanager
from datetime import date, timedelta

import httpx
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ashenfelter import REGIONS, TOP_VINTAGES, calculate_modern_score, calculate_score, extract_year_data
from database import VintageScore, create_tables, get_db
from weather import fetch_weather_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield


app = FastAPI(title="Bordeaux Wine Quality Dashboard", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _score_to_dict(s: VintageScore) -> dict:
    return {
        "year": s.year,
        "score": s.score,
        "modern_score": s.modern_score,
        "winter_rain": s.winter_rain,
        "growth_temp": s.growth_temp,
        "harvest_rain": s.harvest_rain,
        "frost_days": s.frost_days,
        "heat_days": s.heat_days,
        "rain_variance": s.rain_variance,
        "is_top_vintage": s.year in TOP_VINTAGES,
    }


async def _populate_region(region: str, db: Session) -> list[VintageScore]:
    """Fetch all historical weather for a region and persist Ashenfelter scores."""
    reg = REGIONS[region]
    today = date.today()
    end_date = (today - timedelta(days=5)).isoformat()

    logger.info("Fetching weather for %s (1999-10-01 → %s)", region, end_date)
    try:
        df = await fetch_weather_data(reg["lat"], reg["lon"], "1999-10-01", end_date)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail=f"Weather API unavailable: {exc}")

    # Last year whose full growing season (through Sep) has elapsed
    last_full_year = today.year - 1 if today.month <= 9 else today.year

    saved: list[VintageScore] = []
    for year in range(2000, last_full_year + 1):
        existing = db.query(VintageScore).filter_by(region=region, year=year).first()
        if existing:
            saved.append(existing)
            continue

        data = extract_year_data(df, year)
        if data is None:
            logger.warning("Insufficient data for %s %d", region, year)
            continue

        score_val = calculate_score(data["winter_rain"], data["growth_temp"], data["harvest_rain"])
        modern_val = calculate_modern_score(
            data["winter_rain"], data["growth_temp"], data["harvest_rain"],
            data["frost_days"], data["heat_days"],
        )
        vs = VintageScore(
            region=region, year=year,
            score=round(score_val, 3),
            modern_score=round(modern_val, 3),
            **data,
        )
        db.add(vs)
        saved.append(vs)

    db.commit()
    for vs in saved:
        db.refresh(vs)
    return saved


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/regions")
async def get_regions():
    return [
        {"id": k, "name": v["name"], "lat": v["lat"], "lon": v["lon"]}
        for k, v in REGIONS.items()
    ]


@app.get("/api/scores/{region}")
async def get_scores(region: str, db: Session = Depends(get_db)):
    if region not in REGIONS:
        raise HTTPException(status_code=404, detail="Region not found")

    scores = (
        db.query(VintageScore)
        .filter(VintageScore.region == region)
        .order_by(VintageScore.year)
        .all()
    )

    if not scores:
        scores = await _populate_region(region, db)

    return [_score_to_dict(s) for s in scores]


@app.get("/api/scores/{region}/{year}")
async def get_score_year(region: str, year: int, db: Session = Depends(get_db)):
    if region not in REGIONS:
        raise HTTPException(status_code=404, detail="Region not found")

    score = db.query(VintageScore).filter_by(region=region, year=year).first()
    if score:
        return _score_to_dict(score)

    reg = REGIONS[region]
    start = f"{year - 1}-10-01"
    end = (date.today() - timedelta(days=5)).isoformat()

    try:
        df = await fetch_weather_data(reg["lat"], reg["lon"], start, end)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail=f"Weather API unavailable: {exc}")

    data = extract_year_data(df, year)
    if data is None:
        raise HTTPException(status_code=404, detail="Insufficient data for this year")

    score_val = calculate_score(data["winter_rain"], data["growth_temp"], data["harvest_rain"])
    modern_val = calculate_modern_score(
        data["winter_rain"], data["growth_temp"], data["harvest_rain"],
        data["frost_days"], data["heat_days"],
    )
    score = VintageScore(
        region=region, year=year,
        score=round(score_val, 3),
        modern_score=round(modern_val, 3),
        **data,
    )
    db.add(score)
    db.commit()
    db.refresh(score)
    return _score_to_dict(score)


@app.get("/api/current-season/{region}")
async def get_current_season(region: str):
    if region not in REGIONS:
        raise HTTPException(status_code=404, detail="Region not found")

    reg = REGIONS[region]
    today = date.today()

    # Determine vintage year: Oct–Dec belongs to next year's vintage
    vintage_year = today.year + 1 if today.month >= 10 else today.year
    season_start = date(vintage_year - 1, 10, 1)
    season_end = date(vintage_year, 9, 30)

    # Progress through the Oct→Sep season window
    total_days = (season_end - season_start).days + 1
    elapsed_days = (today - season_start).days
    progress = min(int(elapsed_days / total_days * 100), 100)

    fetch_end = (today - timedelta(days=5)).isoformat()
    try:
        df = await fetch_weather_data(reg["lat"], reg["lon"], season_start.isoformat(), fetch_end)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail=f"Weather API unavailable: {exc}")

    m = df["date"].dt.month
    y = df["date"].dt.year

    # Winter rain: Oct (vintage_year-1) → Mar (vintage_year)
    w = df[((y == vintage_year - 1) & (m >= 10)) | ((y == vintage_year) & (m <= 3))]
    winter_complete = today >= date(vintage_year, 4, 1)

    # Growth temp: Apr–Sep (vintage_year) — may be partial
    g = df[(y == vintage_year) & (m >= 4) & (m <= 9)]
    growth_available = today >= date(vintage_year, 4, 1)

    # Harvest rain: Aug–Sep (vintage_year)
    h = df[(y == vintage_year) & (m >= 8) & (m <= 9)]
    harvest_available = today >= date(vintage_year, 8, 1)

    weather_data: dict = {}
    if not w.empty:
        weather_data["winter_rain"] = round(float(w["precipitation"].sum()), 1)
    if growth_available and not g.empty:
        weather_data["growth_temp"] = round(float(g["temperature"].mean()), 2)
    if harvest_available and not h.empty:
        weather_data["harvest_rain"] = round(float(h["precipitation"].sum()), 1)

    partial_score = None
    if "winter_rain" in weather_data and "growth_temp" in weather_data:
        partial_score = round(
            calculate_score(
                weather_data["winter_rain"],
                weather_data["growth_temp"],
                weather_data.get("harvest_rain", 0.0),
            ),
            3,
        )

    return {
        "year": vintage_year,
        "region": region,
        "progress": progress,
        "winter_complete": winter_complete,
        "growth_available": growth_available,
        "harvest_available": harvest_available,
        "is_estimate": not harvest_available,
        "partial_score": partial_score,
        "data": weather_data,
    }


@app.get("/api/export/{region}")
async def export_csv(region: str, db: Session = Depends(get_db)):
    if region not in REGIONS:
        raise HTTPException(status_code=404, detail="Region not found")

    scores = (
        db.query(VintageScore)
        .filter(VintageScore.region == region)
        .order_by(VintageScore.year)
        .all()
    )
    if not scores:
        raise HTTPException(status_code=404, detail="No data for region")

    fields = ["year", "score", "modern_score", "winter_rain", "growth_temp",
              "harvest_rain", "frost_days", "heat_days", "rain_variance", "is_top_vintage"]
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fields)
    writer.writeheader()
    for s in scores:
        writer.writerow(_score_to_dict(s))

    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={region}_vintages.csv"},
    )


@app.post("/api/populate")
async def populate_all(db: Session = Depends(get_db)):
    """Trigger pre-population of all regions. Useful for warming the cache."""
    results = {}
    for region in REGIONS:
        existing_count = db.query(VintageScore).filter(VintageScore.region == region).count()
        if existing_count == 0:
            scores = await _populate_region(region, db)
            results[region] = len(scores)
        else:
            results[region] = existing_count
    return results
