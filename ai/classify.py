import io

import clip
import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image
from pydantic import BaseModel
from rembg import new_session, remove

app = FastAPI(title="Clothing Classifier", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

device = "cuda" if torch.cuda.is_available() else "cpu"
model, preprocess = clip.load("ViT-B/32", device=device)

# Load u2net session once at startup — reused across all /remove-bg requests.
rembg_session = new_session("u2net")

CATEGORY_PROMPTS: dict[str, str] = {
    "formal": "a formal dress shirt, blazer, suit jacket, or tailored trousers",
    "casual": "a casual t-shirt, hoodie, jeans, sneakers, or everyday clothing",
    "sport": "athletic sportswear, gym clothing, running shoes, or activewear",
}

SUBTYPE_PROMPTS: dict[str, str] = {
    "shirt": "a shirt",
    "t-shirt": "a t-shirt",
    "sweater": "a sweater",
    "hoodie": "a hoodie",
    "jacket": "a jacket",
    "coat": "a coat",
    "pants": "pants",
    "jeans": "jeans",
    "shorts": "shorts",
    "skirt": "a skirt",
    "dress": "a dress",
    "shoes": "shoes",
    "sneakers": "sneakers",
    "boots": "boots",
    "suit": "a suit",
    "blazer": "a blazer",
}

COLOR_PROMPTS: dict[str, str] = {
    "black": "black colored clothing",
    "white": "white colored clothing",
    "grey": "grey colored clothing",
    "navy blue": "navy blue colored clothing",
    "blue": "blue colored clothing",
    "light blue": "light blue colored clothing",
    "red": "red colored clothing",
    "burgundy": "burgundy or dark red colored clothing",
    "green": "green colored clothing",
    "olive": "olive or khaki colored clothing",
    "beige": "beige or cream colored clothing",
    "brown": "brown colored clothing",
    "yellow": "yellow colored clothing",
    "orange": "orange colored clothing",
    "pink": "pink colored clothing",
    "purple": "purple colored clothing",
    "multicolor": "multicolored or patterned clothing",
}

FIT_PROMPTS: dict[str, str] = {
    "slim": "slim fit tight-fitting clothing",
    "regular": "regular fit standard cut clothing",
    "relaxed": "relaxed fit loose comfortable clothing",
    "oversized": "oversized extra baggy clothing",
}

SEASON_PROMPTS: dict[str, str] = {
    "spring_summer": "lightweight clothing for warm spring or summer weather",
    "autumn_winter": "medium weight clothing for cool autumn weather",
    "winter": "heavy warm clothing for cold winter weather",
}

SEASON_THRESHOLD = 0.45


class ClassifyResponse(BaseModel):
    category: str
    sub_type: str
    color: str
    fit: str
    season: str


def top_label(
    image_features: torch.Tensor, prompt_dict: dict[str, str]
) -> tuple[str, float]:
    texts = list(prompt_dict.values())
    keys = list(prompt_dict.keys())
    tokens = clip.tokenize(texts).to(device)
    with torch.no_grad():
        text_features = model.encode_text(tokens)
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)
        similarity = (100.0 * image_features @ text_features.T).softmax(dim=-1)
    idx = int(similarity.argmax().item())
    return keys[idx], float(similarity[0][idx].item())


@app.post("/classify", response_model=ClassifyResponse)
async def classify(image: UploadFile = File(...)) -> ClassifyResponse:
    data = await image.read()
    try:
        pil_image = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=422, detail="cannot decode image")

    img_tensor = preprocess(pil_image).unsqueeze(0).to(device)
    with torch.no_grad():
        image_features = model.encode_image(img_tensor)
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)

    category, _ = top_label(image_features, CATEGORY_PROMPTS)
    sub_type, _ = top_label(image_features, SUBTYPE_PROMPTS)
    color, _ = top_label(image_features, COLOR_PROMPTS)
    fit, _ = top_label(image_features, FIT_PROMPTS)
    season, prob = top_label(image_features, SEASON_PROMPTS)
    if prob < SEASON_THRESHOLD:
        season = "all"

    return ClassifyResponse(
        category=category,
        sub_type=sub_type,
        color=color,
        fit=fit,
        season=season,
    )


@app.post("/remove-bg")
async def remove_bg(image: UploadFile = File(...)) -> Response:
    data = await image.read()
    try:
        output = remove(data, session=rembg_session)
    except Exception:
        raise HTTPException(status_code=422, detail="cannot process image")
    return Response(content=output, media_type="image/png")


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}
