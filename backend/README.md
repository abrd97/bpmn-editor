# Backend

## Requirements

- **Python**: 3.13 or higher
- **uv**: Latest version (Python package manager)

## Setup

```bash
uv sync
```

## Development

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at http://localhost:8000
API documentation at http://localhost:8000/docs
