FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py .

# Pre-download the u2netp model (~5 MB) so /remove-bg has no cold-start delay.
# Must match the model loaded in classify.py (KAN-116: u2netp keeps the memory
# baseline low enough to fit Railway's 512 MB cap).
RUN python -c "from rembg import new_session; new_session('u2netp')"

EXPOSE 8001
# Bind Railway's injected $PORT (pinned to 8001 via the ai service variable) so
# the healthcheck and the internal ai.railway.internal:8001 contract stay aligned.
# Falls back to 8001 for local/compose runs where PORT is unset.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}"]
