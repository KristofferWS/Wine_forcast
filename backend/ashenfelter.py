import pandas as pd
from typing import Optional

REGIONS: dict[str, dict] = {
    "pauillac": {"lat": 45.1963, "lon": -0.7539, "name": "Pauillac"},
    "saint-emilion": {"lat": 44.8941, "lon": -0.1553, "name": "Saint-Émilion"},
    "pomerol": {"lat": 44.9167, "lon": -0.1833, "name": "Pomerol"},
    "pessac-leognan": {"lat": 44.7761, "lon": -0.6286, "name": "Pessac-Léognan"},
    "margaux": {"lat": 45.0381, "lon": -0.6706, "name": "Margaux"},
    "saint-julien": {"lat": 45.1167, "lon": -0.7667, "name": "Saint-Julien"},
}

TOP_VINTAGES: set[int] = {2000, 2005, 2009, 2010, 2016, 2022}

# Minimum days required to consider a period's data complete enough
_MIN_WINTER_DAYS = 150   # Oct–Mar is 182 days
_MIN_GROWTH_DAYS = 150   # Apr–Sep is 183 days
_MIN_HARVEST_DAYS = 45   # Aug–Sep is 61 days


def calculate_score(winter_rain: float, growth_temp: float, harvest_rain: float) -> float:
    return -12.145 + (0.00117 * winter_rain) + (0.0614 * growth_temp) - (0.00386 * harvest_rain)


def extract_year_data(df: pd.DataFrame, year: int) -> Optional[dict]:
    """Return Ashenfelter inputs for a given vintage year, or None if data is insufficient."""
    m = df["date"].dt.month
    y = df["date"].dt.year

    winter_mask = ((y == year - 1) & (m >= 10)) | ((y == year) & (m <= 3))
    growth_mask = (y == year) & (m >= 4) & (m <= 9)
    harvest_mask = (y == year) & (m >= 8) & (m <= 9)

    w = df[winter_mask]
    g = df[growth_mask]
    h = df[harvest_mask]

    if len(w) < _MIN_WINTER_DAYS or len(g) < _MIN_GROWTH_DAYS or len(h) < _MIN_HARVEST_DAYS:
        return None

    return {
        "winter_rain": round(float(w["precipitation"].sum()), 1),
        "growth_temp": round(float(g["temperature"].mean()), 2),
        "harvest_rain": round(float(h["precipitation"].sum()), 1),
    }
