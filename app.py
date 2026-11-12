import csv
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

import faiss
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from groq import Groq
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer


PROJECT_DIR = Path(__file__).parent
DATA_FILE = PROJECT_DIR / "data" / "pharma_data.csv"
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b"
templates = Jinja2Templates(directory=PROJECT_DIR / "frontend" / "templates")


def load_documents(path: Path) -> list[str]:
    with path.open(newline="", encoding="utf-8") as file:
        rows = csv.DictReader(file)
        documents = [
            "\n".join(f"{key}: {value}" for key, value in row.items() if value)
            for row in rows
        ]

    if not documents:
        raise ValueError(f"No data rows found in {path}")
    return documents


def build_index(
    documents: list[str], model: SentenceTransformer
) -> faiss.Index:
    embeddings = model.encode(
        documents, convert_to_numpy=True, normalize_embeddings=True
    )
    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(np.asarray(embeddings, dtype="float32"))
    return index


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_dotenv()
    documents = load_documents(DATA_FILE)
    embedding_model = SentenceTransformer(EMBEDDING_MODEL)
    app.state.documents = documents
    app.state.embedding_model = embedding_model
    app.state.index = build_index(documents, embedding_model)
    app.state.groq_api_key = os.getenv("GROQ_API_KEY")
    app.state.groq_model = os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL)
    yield


app = FastAPI(title="Simple Pharma RAG", lifespan=lifespan)
app.mount(
    "/static",
    StaticFiles(directory=PROJECT_DIR / "frontend" / "static"),
    name="static",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class QuestionRequest(BaseModel):
    question: Annotated[str, Field(min_length=1, max_length=2000)]


class QuestionResponse(BaseModel):
    answer: str
    sources: list[str]


def generate_answer(question: str) -> QuestionResponse:
    api_key = app.state.groq_api_key
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY is missing. Add it to the project .env file and restart.",
        )

    question = question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Question cannot be blank.")

    embedding_model = app.state.embedding_model
    query_embedding = embedding_model.encode(
        [question], convert_to_numpy=True, normalize_embeddings=True
    )
    _, matches = app.state.index.search(
        np.asarray(query_embedding, dtype="float32"),
        min(3, len(app.state.documents)),
    )
    sources = [
        app.state.documents[position]
        for position in matches[0]
        if position >= 0
    ]
    context = "\n\n".join(sources)

    response = Groq(api_key=api_key).chat.completions.create(
        model=app.state.groq_model,
        messages=[
            {
                "role": "system",
                "content": (
                    "Answer using only the supplied context. If it does not "
                    "contain the answer, say you do not know. This is a demo "
                    "reference tool, not a source of medical advice."
                ),
            },
            {
                "role": "user",
                "content": f"Context:\n{context}\n\nQuestion: {question}",
            },
        ],
        temperature=0.2,
    )
    answer = response.choices[0].message.content
    return QuestionResponse(answer=answer or "", sources=sources)


@app.get("/", response_class=HTMLResponse)
def home(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"question": "", "answer": None, "sources": [], "error": None},
    )


@app.post("/ask", response_class=HTMLResponse)
def ask_form(
    request: Request,
    question: Annotated[str, Form(max_length=2000)],
) -> HTMLResponse:
    answer = None
    sources: list[str] = []
    error = None
    status_code = 200
    try:
        result = generate_answer(question)
        answer = result.answer
        sources = result.sources
    except HTTPException as exception:
        error = exception.detail
        status_code = exception.status_code

    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "question": question,
            "answer": answer,
            "sources": sources,
            "error": error,
        },
        status_code=status_code,
    )


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/ask", response_model=QuestionResponse)
def ask_question(request: QuestionRequest) -> QuestionResponse:
    return generate_answer(request.question)
