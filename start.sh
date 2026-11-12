#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="${PYTHON:-python}"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "Python executable '$PYTHON_BIN' was not found. Set PYTHON to your Python executable." >&2
  exit 1
fi

if ! "$PYTHON_BIN" -c "import uvicorn" >/dev/null 2>&1; then
  echo "Backend dependencies are missing for '$PYTHON_BIN'." >&2
  echo "Install them with: $PYTHON_BIN -m pip install -r \"$ROOT_DIR/requirements.txt\"" >&2
  echo "To use a specific interpreter, run: PYTHON=/path/to/python ./start.sh" >&2
  exit 1
fi

exec "$PYTHON_BIN" -m uvicorn app:app --app-dir "$ROOT_DIR" --host 0.0.0.0 --port 8000
