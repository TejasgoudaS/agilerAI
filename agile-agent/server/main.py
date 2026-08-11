import os
import json
import queue
import threading
import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from crew_pipeline import run_pipeline

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

app = FastAPI(title="AI Agile Story Generator - Agent Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok", "agents": ["Architect", "PM", "Engineer"]}


@app.post("/api/generate-stories")
async def generate_stories(request: Request):
    """
    Run the CrewAI multi-agent pipeline and stream results via SSE.
    
    Expects JSON body: { prdText, epics, team }
    Streams SSE events: agent_start, agent_thought, agent_complete, final_result
    """
    data = await request.json()
    prd_text = data.get("prdText", "")
    epics = data.get("epics", [])
    team = data.get("team", [])

    event_queue = queue.Queue()

    def run():
        try:
            run_pipeline(prd_text, epics, team, event_queue)
        except Exception as e:
            event_queue.put({"type": "error", "message": str(e)})
        finally:
            event_queue.put(None)  # Signal stream end

    thread = threading.Thread(target=run, daemon=True)
    thread.start()

    async def event_stream():
        while True:
            try:
                item = event_queue.get(timeout=0.5)
                if item is None:
                    # Send final close event
                    yield f"data: {json.dumps({'type': 'stream_end'})}\n\n"
                    break
                yield f"data: {json.dumps(item)}\n\n"
            except queue.Empty:
                # Heartbeat to keep connection alive
                yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
                await asyncio.sleep(0.1)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting AI Agent Server on http://localhost:8000")
    print("   Agents: Architect → PM → Engineer")
    uvicorn.run(app, host="0.0.0.0", port=8000)
