FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py .

# Pre-download the u2netp model (~5 MB) so /remove-bg has no cold-start delay.
# Must match the model loaded in classify.py (KAN-116: u2netp for low memory footprint).
RUN python -c "from rembg import new_session; new_session('u2netp')"

EXPOSE 8001
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}"]
