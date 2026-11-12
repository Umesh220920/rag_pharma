# Simple Pharma RAG

A small local web app: FastAPI renders the interface and serves the API, embeds
CSV records with Sentence Transformers, searches them with FAISS, and sends
matching records to Groq for an answer. The application is Python-based and
does not need Node.js or a JavaScript build step.

## Run it

1. Use Python 3.10 or newer and install the backend dependencies:

   ```bash
   python -m pip install -r requirements.txt
   ```

2. Copy `.env.example` to `.env` and add your Groq API key:

   ```bash
   cp -n .env.example .env
   ```

   If you already have a `.env` file, keep it and make sure it contains
   `GROQ_API_KEY=your_actual_key`. The default Groq model is
   `openai/gpt-oss-120b`; set `GROQ_MODEL` in `.env` to use another model
   available to your account.

3. Start the app:

   ```bash
   ./start.sh
   ```

The same Python interpreter must be used to install and run the dependencies.
If needed, set it explicitly, for example:

```bash
PYTHON=/home/codespace/.python/current/bin/python ./start.sh
```

The launcher prints the matching install command if it cannot find Uvicorn.
Open http://localhost:8000 in your browser. The first startup downloads the
embedding model; the API docs are available at http://localhost:8000/docs.
Stop the server with Ctrl+C.

## Use your own data

Replace `data/pharma_data.csv` with your own CSV. The app turns each row into a
searchable record by combining its non-empty columns. Use accurate,
organization-approved data; the included records are generic examples, not
medical guidance. This demo is not intended for clinical decision-making.
