from fastapi import FastAPI

from app.routes.users import router as users_router

app = FastAPI(title="Civic User Profile Service")

app.include_router(users_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}