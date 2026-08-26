from __future__ import annotations
import sys

if sys.version_info < (3, 11) or sys.version_info >= (3, 15):
    raise RuntimeError(
        f"Versión de Python no soportada: {sys.version.split()[0]}. "
        "El backend del motor vectorbt requiere estrictamente Python >= 3.11, < 3.15."
    )

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .api.health import router as health_router
from .api.backtest import router as backtest_router

app = FastAPI(
    title="Vectorbt Quantitative Engine Backend",
    description="Microservicio de simulación cuantitativa con vectorbt y validación estricta de datasets.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(backtest_router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Error interno en motor vectorbt: {str(exc)}"}
    )
