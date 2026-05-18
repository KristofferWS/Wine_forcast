import os
from sqlalchemy import create_engine, Column, Integer, Float, String, UniqueConstraint
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
    winter_rain = Column(Float)
    growth_temp = Column(Float)
    harvest_rain = Column(Float)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
