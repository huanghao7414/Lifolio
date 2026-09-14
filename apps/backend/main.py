from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.routes import transactions, items, ai, insights, dashboard, conversations
from app.routes import settings as settings_routes
from app.routes import auth, admin, users
from app.services.monitoring_service import MetricsMiddleware
from app.services.admin_service import database_probe
from app.services.llm_service import LLMNotConfigured, InvalidLLMConfig, provider_error_message

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
app.include_router(conversations.router, prefix="/api/conversations", tags=["conversations"])
app.include_router(settings_routes.router, prefix="/api/settings", tags=["settings"])
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(admin.router, prefix="/api/admin", tags=["administration"])
app.include_router(users.router, prefix="/api", tags=["users"])
app.add_middleware(MetricsMiddleware)


@app.get("/ready")
async def readiness():
    probe = await database_probe()
    return JSONResponse(status_code=200 if probe["status"] == "ok" else 503, content={"status": probe["status"]})


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError):
    # Pydantic's default errors include the rejected input, which can contain API keys.
    errors = [{"loc": err["loc"], "msg": err["msg"], "type": err["type"]} for err in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": errors})


@app.exception_handler(LLMNotConfigured)
@app.exception_handler(InvalidLLMConfig)
async def llm_error(_request: Request, exc: Exception):
    return JSONResponse(status_code=400, content={"detail": provider_error_message(exc)})


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
