FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py .

# Pre-download CLIP model so container starts instantly (avoids 338MB download on every restart)
RUN python -c "import clip; clip.load('ViT-B/32', device='cpu')"

# Pre-download u2net model (~176 MB) so /remove-bg has no cold-start delay
RUN python -c "from rembg import new_session; new_session('u2net')"

EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
