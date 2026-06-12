import asyncio
import io
import json
import os
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from google import genai
from google.genai import types
import pillow_avif  # noqa: F401 — registers AVIF codec in Pillow (phone uploads, seed images)
from PIL import Image
from pydantic import BaseModel
from rembg import new_session, remove

router = APIRouter(tags=["classify"])

_client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
_executor = ThreadPoolExecutor(max_workers=4)

_MODEL = "gemini-2.5-flash"

# Load u2net session once at startup — reused across all /remove-bg requests.
rembg_session = new_session("u2net")

_PROMPT = """Analyze this clothing item and return ONLY a JSON object with these exact keys and allowed values:
- category: one of ["formal", "casual", "sport"]
- sub_type: one of ["shirt", "t-shirt", "sweater", "hoodie", "jacket", "coat", "pants", "jeans", "shorts", "skirt", "dress", "shoes", "sneakers", "boots", "suit", "blazer"]
- color: one of ["black", "white", "grey", "navy blue", "blue", "light blue", "red", "burgundy", "green", "olive", "beige", "brown", "yellow", "orange", "pink", "purple", "multicolor"]
- fit: one of ["slim", "regular", "relaxed", "oversized"]
- season: one of ["spring_summer", "autumn_winter", "winter", "all"]

Return ONLY valid JSON with no explanation, no markdown fences."""


class ClassifyResponse(BaseModel):
    category: str
    sub_type: str
    color: str
    fit: str
    season: str


def _classify_sync(image_bytes: bytes) -> dict:
    response = _client.models.generate_content(
        model=_MODEL,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
            _PROMPT,
        ],
    )
    text = response.text.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


@router.post("/classify", response_model=ClassifyResponse)
async def classify(image: UploadFile = File(...)) -> ClassifyResponse:
    data = await image.read()
    try:
        pil_image = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=422, detail="cannot decode image")

    buf = io.BytesIO()
    pil_image.save(buf, format="JPEG", quality=85)

    loop = asyncio.get_running_loop()
    try:
        parsed = await loop.run_in_executor(_executor, _classify_sync, buf.getvalue())
        return ClassifyResponse(**parsed)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"parse error: {e}")
    except Exception as e:
        msg = str(e)
        if "429" in msg or "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower():
            raise HTTPException(status_code=503, detail="AI quota exhausted — please try again later")
        raise HTTPException(status_code=500, detail=f"classification failed: {e}")



@router.post("/remove-bg")
async def remove_bg(image: UploadFile = File(...)) -> Response:
    data = await image.read()
    try:
        output = remove(data, session=rembg_session)
    except Exception:
        raise HTTPException(status_code=422, detail="cannot process image")
    return Response(content=output, media_type="image/png")
