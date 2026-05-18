import httpx
import pandas as pd
from datetime import date, timedelta

BASE_URL = "https://archive-api.open-meteo.com/v1/archive"
# Keep 5-day buffer so we never request dates the archive hasn't processed yet
ARCHIVE_LAG_DAYS = 5


def _safe_end_date(requested_end: str) -> str:
    max_date = (date.today() - timedelta(days=ARCHIVE_LAG_DAYS)).isoformat()
    return min(requested_end, max_date)


async def fetch_weather_data(lat: float, lon: float, start_date: str, end_date: str) -> pd.DataFrame:
    end_date = _safe_end_date(end_date)

    if start_date > end_date:
        return pd.DataFrame(columns=["date", "temperature", "precipitation"])

    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "daily": "temperature_2m_mean,temperature_2m_min,temperature_2m_max,precipitation_sum",
        "timezone": "Europe/Paris",
    }

    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.get(BASE_URL, params=params)
        response.raise_for_status()
        payload = response.json()

    daily = payload["daily"]
    df = pd.DataFrame({
        "date": pd.to_datetime(daily["time"]),
        "temperature": pd.to_numeric(daily["temperature_2m_mean"], errors="coerce"),
        "temperature_min": pd.to_numeric(daily["temperature_2m_min"], errors="coerce"),
        "temperature_max": pd.to_numeric(daily["temperature_2m_max"], errors="coerce"),
        "precipitation": pd.to_numeric(daily["precipitation_sum"], errors="coerce"),
    })
    df["precipitation"] = df["precipitation"].fillna(0.0)
    df = df.dropna(subset=["temperature"])
    return df
