import base64
import io
import os

import anthropic
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image
from pydantic import BaseModel
from rembg import new_session, remove

router = APIRouter(tags=["classify"])

_claude = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

# Load u2net session once at startup — reused across all /remove-bg requests.
rembg_session = new_session("u2net")

_CLASSIFY_TOOL = {
    "name": "classify_clothing",
    "description": "Classify a clothing item from an image.",
    "input_schema": {
        "type": "object",
        "properties": {
            "category": {
                "type": "string",
                "enum": ["formal", "casual", "sport"],
                "description": "Overall clothing category",
            },
            "sub_type": {
                "type": "string",
                "enum": [
                    "shirt", "t-shirt", "sweater", "hoodie", "jacket", "coat",
                    "pants", "jeans", "shorts", "skirt", "dress",
                    "shoes", "sneakers", "boots", "suit", "blazer",
                ],
                "description": "Specific clothing type",
            },
            "color": {
                "type": "string",
                "enum": [
                    "black", "white", "grey", "navy blue", "blue", "light blue",
                    "red", "burgundy", "green", "olive", "beige", "brown",
                    "yellow", "orange", "pink", "purple", "multicolor",
                ],
                "description": "Primary color of the garment",
            },
            "fit": {
                "type": "string",
                "enum": ["slim", "regular", "relaxed", "oversized"],
                "description": "Fit style of the garment",
            },
            "season": {
                "type": "string",
                "enum": ["spring_summer", "autumn_winter", "winter", "all"],
                "description": "Suitable season(s) for the garment",
            },
        },
        "required": ["category", "sub_type", "color", "fit", "season"],
    },
}


class ClassifyResponse(BaseModel):
    category: str
    sub_type: str
    color: str
    fit: str
    season: str


@router.post("/classify", response_model=ClassifyResponse)
async def classify(image: UploadFile = File(...)) -> ClassifyResponse:
    data = await image.read()
    try:
        pil_image = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=422, detail="cannot decode image")

    buf = io.BytesIO()
    pil_image.save(buf, format="JPEG")
    image_b64 = base64.standard_b64encode(buf.getvalue()).decode()

    response = await _claude.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        tools=[_CLASSIFY_TOOL],
        tool_choice={"type": "any"},
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": image_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": "Classify this clothing item using the classify_clothing tool.",
                    },
                ],
            }
        ],
    )

    tool_block = next((b for b in response.content if b.type == "tool_use"), None)
    if tool_block is None:
        raise HTTPException(status_code=500, detail="Classification failed")

    return ClassifyResponse(**tool_block.input)


@router.post("/remove-bg")
async def remove_bg(image: UploadFile = File(...)) -> Response:
    data = await image.read()
    try:
        output = remove(data, session=rembg_session)
    except Exception:
        raise HTTPException(status_code=422, detail="cannot process image")
    return Response(content=output, media_type="image/png")
