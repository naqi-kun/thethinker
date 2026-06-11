from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from classify import router as classify_router
from recommend import router as recommend_router

app = FastAPI(title="TheThinker AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(classify_router)
app.include_router(recommend_router)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}
