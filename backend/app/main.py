from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from app.dependencies import (
    get_session_service,
    get_collaboration_service,
    get_session_id,
    get_user_id
)
from app.services.session_service import SessionService
from app.services.collaboration_service import CollaborationService
from app.models.message import CollaborationMessage
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="BPMN Editor Backend",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: Optional[str] = Depends(get_session_id),
    user_id: Optional[str] = Depends(get_user_id),
    session_service: SessionService = Depends(get_session_service),
    collaboration_service: CollaborationService = Depends(get_collaboration_service),
):
    """
    WebSocket endpoint for real-time collaboration.
    
    Handles:
    - Session creation/joining (via query param)
    - User assignment (from cookie if exists, otherwise new)
    - Message routing
    - State synchronization
    """
    try:
        session = session_service.get_or_create_session(session_id)
        session_uuid = session.id
        
        user = collaboration_service.get_or_create_user(user_id)
        
        await collaboration_service.connect(websocket, session_uuid, user)
        
        logger.info(f"User {user.id} connected to session {session_uuid}")
        
        while True:
            try:
                data = await websocket.receive_text()
                message_dict = json.loads(data)
                
                message = CollaborationMessage(**message_dict)
                
                await collaboration_service.handle_message(websocket, message)
                
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON received: {e}")
                # Send error response (note: "error" is not a standard MessageType, but useful for debugging)
                error_response = {
                    "type": "error",
                    "userId": "system",
                    "sessionId": str(session_uuid),
                    "payload": {"error": "Invalid message format"}
                }
                await websocket.send_text(json.dumps(error_response))
            
            except Exception as e:
                logger.error(f"Error handling message: {e}")
    
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
        await collaboration_service.disconnect(websocket)
    
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await collaboration_service.disconnect(websocket)
        except Exception:
            pass
