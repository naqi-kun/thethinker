import json
import os
import uuid

import anthropic
from fastapi import APIRouter, HTTPException
from langgraph.checkpoint.memory import MemorySaver
from langgraph.constants import END, START
from langgraph.graph import StateGraph
from langgraph.types import Command, interrupt
from pydantic import BaseModel
from typing_extensions import TypedDict


# ── HTTP I/O models ────────────────────────────────────────────────────────────

class WardrobeItem(BaseModel):
    id: str
    sub_type: str
    category: str
    color: str
    fit: str
    season: str


class Recommendation(BaseModel):
    top_id: str
    bottom_id: str
    shoes_id: str
    reasoning: str


class StartRequest(BaseModel):
    session_id: str | None = None
    wardrobe_items: list[WardrobeItem]
    occasion: str | None = None       # wardrobe occasion category to dress for
    event_name: str | None = None     # human label of the chosen calendar event
    aesthetic: str | None = None      # the user's chosen aesthetic/vibe


class StartResponse(BaseModel):
    session_id: str
    status: str
    recommendation: Recommendation


class FeedbackRequest(BaseModel):
    session_id: str
    action: str  # "accept" | "regenerate"


class FeedbackResponse(BaseModel):
    status: str
    recommendation: Recommendation | None = None


# ── LangGraph state ────────────────────────────────────────────────────────────

class RecommendationState(TypedDict):
    wardrobe_candidates: list[dict]
    tops: list[dict]
    bottoms: list[dict]
    footwear: list[dict]
    current_recommendation: dict | None
    disliked_combinations: list[dict]
    user_action: str | None
    occasion: str | None
    event_name: str | None
    aesthetic: str | None


# ── Claude client ──────────────────────────────────────────────────────────────

_claude = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

_SELECT_OUTFIT_TOOL = {
    "name": "select_outfit",
    "description": "Select one complete outfit from the available wardrobe items.",
    "input_schema": {
        "type": "object",
        "properties": {
            "top_id": {"type": "string", "description": "id of the chosen top"},
            "bottom_id": {"type": "string", "description": "id of the chosen bottom"},
            "shoes_id": {"type": "string", "description": "id of the chosen footwear"},
            "reasoning": {
                "type": "string",
                "description": "One-sentence style rationale for this combination",
            },
        },
        "required": ["top_id", "bottom_id", "shoes_id", "reasoning"],
    },
}

_TOP_SUBTYPES = {"shirt", "t-shirt", "sweater", "hoodie", "jacket", "coat", "blazer", "suit"}
_BOTTOM_SUBTYPES = {"pants", "jeans", "shorts", "skirt", "dress"}
_FOOTWEAR_SUBTYPES = {"shoes", "sneakers", "boots"}


# ── Graph nodes ────────────────────────────────────────────────────────────────

def filter_closet(state: RecommendationState) -> dict:
    tops, bottoms, footwear = [], [], []
    for item in state["wardrobe_candidates"]:
        st = item.get("sub_type", "")
        if st in _TOP_SUBTYPES:
            tops.append(item)
        elif st in _BOTTOM_SUBTYPES:
            bottoms.append(item)
        elif st in _FOOTWEAR_SUBTYPES:
            footwear.append(item)
    return {"tops": tops, "bottoms": bottoms, "footwear": footwear}


def _build_prompt(state: RecommendationState) -> str:
    def fmt(items: list[dict]) -> str:
        return "\n".join(
            f"  id={i['id']}  color={i['color']}  fit={i.get('fit', 'regular')}  type={i['sub_type']}"
            for i in items
        )

    brief_lines = []
    aesthetic = (state.get("aesthetic") or "").strip()
    if aesthetic:
        brief_lines.append(
            f"- Aesthetic / vibe: {aesthetic}. Let this steer the overall look — "
            "favor items and combinations that read as this style."
        )
    occasion = (state.get("occasion") or "").strip()
    event_name = (state.get("event_name") or "").strip()
    if occasion and occasion != "everyday":
        if event_name:
            brief_lines.append(f"- Dress for: {event_name} — a {occasion} occasion. Match this formality.")
        else:
            brief_lines.append(f"- Dress for a {occasion} occasion. Match this formality.")
    elif occasion == "everyday":
        brief_lines.append("- Everyday wear — comfortable, no specific event to match.")
    brief_section = ""
    if brief_lines:
        brief_section = "STYLING BRIEF (prioritize this):\n" + "\n".join(brief_lines) + "\n\n"

    blocklist = state.get("disliked_combinations") or []
    blocklist_section = ""
    if blocklist:
        entries = "\n".join(
            f"  top_fit={b['top_fit']}  top_color={b['top_color']}"
            f"  bottom_fit={b['bottom_fit']}  bottom_color={b['bottom_color']}"
            for b in blocklist
        )
        blocklist_section = (
            "\nDISLIKED COMBINATIONS (BLOCKLIST) — do NOT produce an outfit that matches any entry below.\n"
            "A match means your chosen top's (fit, color) AND your chosen bottom's (fit, color) both match "
            "a blocklist row. If they do, pick different items.\n"
            f"{entries}\n"
        )

    return (
        "You are a personal stylist. Select one complete outfit from the wardrobe below.\n\n"
        f"{brief_section}"
        "STYLING RULES:\n"
        "1. Avoid clashing colors (e.g. bright red top + bright green bottom).\n"
        "2. Match formality: casual tops with casual bottoms; formal with formal.\n"
        "3. Complementary fits: slim top pairs well with slim or regular bottom.\n"
        "4. Neutral colors (black, white, grey, navy, beige) pair with anything.\n"
        f"{blocklist_section}\n"
        f"TOPS:\n{fmt(state['tops'])}\n\n"
        f"BOTTOMS:\n{fmt(state['bottoms'])}\n\n"
        f"FOOTWEAR:\n{fmt(state['footwear'])}\n\n"
        "Call the select_outfit tool with your choice."
    )


async def stylist_engine(state: RecommendationState) -> dict:
    if not state["tops"] or not state["bottoms"] or not state["footwear"]:
        raise ValueError("Wardrobe missing tops, bottoms, or footwear.")

    response = await _claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        tools=[_SELECT_OUTFIT_TOOL],
        tool_choice={"type": "any"},
        messages=[{"role": "user", "content": _build_prompt(state)}],
    )

    tool_block = next((b for b in response.content if b.type == "tool_use"), None)
    if tool_block is None:
        raise ValueError("Claude did not call the select_outfit tool")
    outfit: dict = tool_block.input
    return {"current_recommendation": outfit, "user_action": None}


def collect_feedback(state: RecommendationState) -> dict:
    action = interrupt({"recommendation": state["current_recommendation"]})
    return {"user_action": action}


def process_feedback(state: RecommendationState) -> dict:
    rec = state["current_recommendation"]
    if rec is None:
        return {}
    top_item = next((i for i in state["tops"] if i["id"] == rec["top_id"]), None)
    bottom_item = next((i for i in state["bottoms"] if i["id"] == rec["bottom_id"]), None)
    if top_item is None or bottom_item is None:
        return {}
    new_entry = {
        "top_fit": top_item.get("fit", "regular"),
        "top_color": top_item["color"],
        "bottom_fit": bottom_item.get("fit", "regular"),
        "bottom_color": bottom_item["color"],
    }
    existing = state.get("disliked_combinations") or []
    return {"disliked_combinations": existing + [new_entry]}


def _route_feedback(state: RecommendationState) -> str:
    return END if state.get("user_action") == "accept" else "process_feedback"


# ── Compiled graph ─────────────────────────────────────────────────────────────

_memory = MemorySaver()

_g = StateGraph(RecommendationState)
_g.add_node("filter_closet", filter_closet)
_g.add_node("stylist_engine", stylist_engine)
_g.add_node("collect_feedback", collect_feedback)
_g.add_node("process_feedback", process_feedback)
_g.add_edge(START, "filter_closet")
_g.add_edge("filter_closet", "stylist_engine")
_g.add_edge("stylist_engine", "collect_feedback")
_g.add_conditional_edges(
    "collect_feedback",
    _route_feedback,
    {END: END, "process_feedback": "process_feedback"},
)
_g.add_edge("process_feedback", "stylist_engine")

graph = _g.compile(checkpointer=_memory)


# ── FastAPI router ─────────────────────────────────────────────────────────────

router = APIRouter(prefix="/recommend", tags=["recommend"])


@router.post("/start", response_model=StartResponse)
async def recommend_start(body: StartRequest) -> StartResponse:
    session_id = body.session_id or str(uuid.uuid4())
    config = {"configurable": {"thread_id": session_id}}

    initial: RecommendationState = {
        "wardrobe_candidates": [i.model_dump() for i in body.wardrobe_items],
        "tops": [],
        "bottoms": [],
        "footwear": [],
        "current_recommendation": None,
        "disliked_combinations": [],
        "user_action": None,
        "occasion": body.occasion,
        "event_name": body.event_name,
        "aesthetic": body.aesthetic,
    }

    try:
        result = await graph.ainvoke(initial, config=config)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    rec = result.get("current_recommendation")
    if rec is None:
        raise HTTPException(status_code=500, detail="Stylist failed to produce a recommendation.")

    return StartResponse(
        session_id=session_id,
        status="awaiting_feedback",
        recommendation=Recommendation(**rec),
    )


@router.post("/feedback", response_model=FeedbackResponse)
async def recommend_feedback(body: FeedbackRequest) -> FeedbackResponse:
    if body.action not in ("accept", "regenerate"):
        raise HTTPException(status_code=422, detail="action must be 'accept' or 'regenerate'.")

    config = {"configurable": {"thread_id": body.session_id}}

    snapshot = await graph.aget_state(config)
    if not snapshot or not snapshot.next:
        raise HTTPException(status_code=404, detail="Session not found or already completed.")

    result = await graph.ainvoke(Command(resume=body.action), config=config)

    if body.action == "accept":
        return FeedbackResponse(status="accepted")

    rec = result.get("current_recommendation")
    if rec is None:
        raise HTTPException(status_code=500, detail="Stylist failed to produce a new recommendation.")

    return FeedbackResponse(
        status="awaiting_feedback",
        recommendation=Recommendation(**rec),
    )
