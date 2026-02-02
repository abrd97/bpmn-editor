# BPMN Editor Backend

FastAPI backend for real-time collaborative BPMN editor.

## Features

- **WebSocket-based collaboration**: Single `/ws` endpoint for all real-time communication
- **Session management**: In-memory session storage with UUID identifiers
- **User management**: Automatic user generation with unique colors
- **Message routing**: Broadcasts messages to all users in a session
- **State synchronization**: Stores BPMN XML per session, syncs on join

## Architecture

```
app/
├── models/          # Pydantic models (User, Session, Messages)
├── repositories/    # In-memory data access layer
├── services/        # Business logic layer
├── dependencies.py  # FastAPI dependency injection
└── main.py         # FastAPI application and routes
```

## Running

```bash
# Install dependencies
uv sync

# Run server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

### WebSocket: `/ws`

Connects to a collaboration session. Supports:
- Query parameter: `?session=<uuid>` - Join existing session
- Cookie: `session_id` - Alternative way to specify session
- Auto-creates session if none provided

### REST: `/api/sessions/{session_id}`

Get session information (GET)

## Message Types

All messages follow the `CollaborationMessage` format:

- `join` - User joins session (sent by backend)
- `leave` - User leaves session (sent by backend)
- `sync` - Full diagram state (sent by backend on join, or by client to update)
- `command` - BPMN command (move, create, delete, etc.)
- `cursor` - Cursor position updates
- `lock` - Element lock notification
- `unlock` - Element unlock notification

## Notes

- Fast-changing data (commands, cursors) are **not stored** - only propagated
- Only `sync` messages update the stored BPMN XML
- Sessions are stored in-memory (will be lost on server restart)
- No authentication required (as per requirements)
