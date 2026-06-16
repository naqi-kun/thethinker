import asyncio
import base64
import io
import os
from concurrent.futures import ThreadPoolExecutor

import anthropic
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
import pillow_avif  # noqa: F401 — registers AVIF codec in Pillow (phone uploads, seed images)
from PIL import Image
from pydantic import BaseModel
from rembg import new_session, remove

router = APIRouter(tags=["classify"])

_client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
_executor = ThreadPoolExecutor(max_workers=4)

_MODEL = "claude-sonnet-4-6"

# Largest edge (px) we send to the vision model. Garment classification doesn't
# need full phone resolution — downscaling cuts tokens, latency, and keeps the
# base64 payload well under Anthropic's image limits.
_MAX_EDGE = 1024

# Load u2net session once at startup — reused across all /remove-bg requests.
rembg_session = new_session("u2net")

# Allowed enum values, shared by the tool schema and kept in sync with the Go
# domain layer (internal/domain/wardrobe/entity.go).
_CATEGORIES = ["formal", "casual", "sport"]
_SUB_TYPES = [
    "shirt", "t-shirt", "sweater", "hoodie", "jacket", "coat", "pants", "jeans",
    "shorts", "skirt", "dress", "shoes", "sneakers", "boots", "suit", "blazer",
    # accessories
    "watch", "bag", "belt", "hat", "scarf", "sunglasses", "tie",
]
_COLORS = [
    "black", "white", "grey", "navy blue", "blue", "light blue", "red",
    "burgundy", "green", "olive", "beige", "brown", "yellow", "orange", "pink",
    "purple", "multicolor",
]
_FITS = ["slim", "regular", "relaxed", "oversized"]
_SEASONS = ["spring_summer", "autumn_winter", "winter", "all"]

# Forcing a tool call with an enum-constrained schema guarantees the model
# returns one of the allowed values for every field (no free-text parsing).
_CLASSIFY_TOOL = {
    "name": "classify_item",
    "description": "Record the classification of the scanned image.",
    "input_schema": {
        "type": "object",
        "properties": {
            "is_wearable": {
                "type": "boolean",
                "description": (
                    "True if the image shows a single wearable item: a garment, a pair "
                    "of footwear, or an accessory (bag, watch, belt, hat, scarf, "
                    "sunglasses, tie). False for people wearing full outfits, food, "
                    "animals, furniture, or empty scenes."
                ),
            },
            "category": {"type": "string", "enum": _CATEGORIES},
            "sub_type": {"type": "string", "enum": _SUB_TYPES},
            "color": {"type": "string", "enum": _COLORS},
            "fit": {"type": "string", "enum": _FITS},
            "season": {"type": "string", "enum": _SEASONS},
            "confidence": {
                "type": "number",
                "description": (
                    "Your honest confidence from 0.0 to 1.0 that the category, "
                    "sub_type, color, fit and season are correct. Use the full range: "
                    "lower it when the garment is ambiguous, partially visible, or "
                    "poorly lit; raise it for a clear, well-lit, unambiguous item."
                ),
            },
        },
        "required": ["is_wearable", "category", "sub_type", "color", "fit", "season", "confidence"],
    },
}

_PROMPT = (
    "You are a wardrobe classifier. Decide whether the image shows a single wearable "
    "item — a garment, a pair of footwear, or an accessory (bag, watch, belt, hat, "
    "scarf, sunglasses, tie).\n"
    "- If it does NOT (a person wearing a full outfit, food, an animal, furniture, or "
    "an empty scene), set is_wearable to false. Still provide best-guess values for "
    "the other fields — they will be ignored.\n"
    "- If it does, set is_wearable to true and classify it accurately. Pick the closest "
    "sub_type; for accessories the category/fit/season fields may be approximate.\n"
    "Always report your real confidence — do not default to a fixed value.\n"
    "Call the classify_item tool with your answer."
)


class ClassifyResponse(BaseModel):
    category: str
    sub_type: str
    color: str
    fit: str
    season: str
    confidence_score: float


def _classify_sync(image_bytes: bytes) -> dict:
    b64 = base64.standard_b64encode(image_bytes).decode("ascii")
    response = _client.messages.create(
        model=_MODEL,
        max_tokens=512,
        tools=[_CLASSIFY_TOOL],
        tool_choice={"type": "tool", "name": "classify_item"},
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": "image/jpeg", "data": b64},
                    },
                    {"type": "text", "text": _PROMPT},
                ],
            }
        ],
    )
    tool_block = next((b for b in response.content if b.type == "tool_use"), None)
    if tool_block is None:
        raise ValueError("Claude did not call the classify_item tool")
    return dict(tool_block.input)


@router.post("/classify", response_model=ClassifyResponse)
async def classify(image: UploadFile = File(...)) -> ClassifyResponse:
    data = await image.read()
    try:
        pil_image = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=422, detail="cannot decode image")

    pil_image.thumbnail((_MAX_EDGE, _MAX_EDGE))
    buf = io.BytesIO()
    pil_image.save(buf, format="JPEG", quality=85)

    loop = asyncio.get_running_loop()
    try:
        parsed = await loop.run_in_executor(_executor, _classify_sync, buf.getvalue())
    except anthropic.RateLimitError:
        raise HTTPException(status_code=503, detail="AI quota exhausted — please try again later")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"classification failed: {e}")

    if not parsed.get("is_wearable", False):
        raise HTTPException(
            status_code=422,
            detail="not a wearable item — scan a single garment, pair of shoes, or accessory",
        )

    return ClassifyResponse(
        category=parsed["category"],
        sub_type=parsed["sub_type"],
        color=parsed["color"],
        fit=parsed["fit"],
        season=parsed["season"],
        confidence_score=float(parsed["confidence"]),
    )



@router.post("/remove-bg")
async def remove_bg(image: UploadFile = File(...)) -> Response:
    data = await image.read()
    try:
        output = remove(data, session=rembg_session)
    except Exception:
        raise HTTPException(status_code=422, detail="cannot process image")
    return Response(content=output, media_type="image/png")
