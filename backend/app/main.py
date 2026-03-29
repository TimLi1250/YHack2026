from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.ballots import router as ballots_router
from app.routes.candidates import router as candidates_router
from app.routes.elections import router as elections_router
from app.routes.legislation import router as legislation_router
from app.routes.meetings import router as meetings_router
from app.routes.notifications import router as notifications_router
from app.routes.users import router as users_router

app = FastAPI(title="Civic AI Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users_router)
app.include_router(ballots_router)
app.include_router(candidates_router)
app.include_router(elections_router)
app.include_router(legislation_router)
app.include_router(meetings_router)
app.include_router(notifications_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}