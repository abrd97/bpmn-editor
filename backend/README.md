# BPMN Editor Backend

FastAPI backend for real-time collaborative BPMN editor.

## Requirements

- Python >= 3.13
- [uv](https://github.com/astral-sh/uv) package manager

## Development

```bash
# Install dependencies
uv sync

# Run development server
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Production

```bash
# Install dependencies
uv sync

# Run production server
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```
