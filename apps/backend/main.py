from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routes import transactions, items, ai, insights, dashboard

app = FastAPI(
    title="Lifolio API",
    description="AI-powered personal life asset management",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(items.router, prefix="/api/items", tags=["items"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(insights.router, prefix="/api/insights", tags=["insights"])
app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
