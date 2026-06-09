FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY classify.py .

# Pre-download CLIP model so container starts instantly (avoids 338MB download on every restart)
RUN python -c "import clip; clip.load('ViT-B/32', device='cpu')"

EXPOSE 8001
CMD ["uvicorn", "classify:app", "--host", "0.0.0.0", "--port", "8001"]
