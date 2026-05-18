import os
from sqlalchemy import Column, Float, Integer, String, UniqueConstraint, create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./wine_quality.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class VintageScore(Base):
    __tablename__ = "vintage_scores"
    __table_args__ = (UniqueConstraint("region", "year"),)

    id = Column(Integer, primary_key=True, index=True)
    region = Column(String, index=True)
    year = Column(Integer)
    score = Column(Float)
    modern_score = Column(Float, nullable=True)
    winter_rain = Column(Float)
    growth_temp = Column(Float)
    harvest_rain = Column(Float)
    frost_days = Column(Integer, nullable=True)
    heat_days = Column(Integer, nullable=True)
    rain_variance = Column(Float, nullable=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
    # SQLite migration: add new columns to existing tables without losing data
    _new_cols = [
        ("modern_score", "REAL"),
        ("frost_days", "INTEGER"),
        ("heat_days", "INTEGER"),
        ("rain_variance", "REAL"),
    ]
    with engine.connect() as conn:
        for col_name, col_type in _new_cols:
            try:
                conn.execute(text(f"ALTER TABLE vintage_scores ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception:
                pass  # column already exists
