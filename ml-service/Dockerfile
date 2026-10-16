# Runs the ResolveIQ ML service on Hugging Face Spaces (Docker SDK). Spaces expect port 7860 and run as user 1000.
FROM python:3.12-slim

RUN useradd -m -u 1000 user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    HF_HOME=/home/user/.cache/huggingface \
    MODEL_DIR=/home/user/app/models \
    PYTHONUNBUFFERED=1
WORKDIR /home/user/app

# CPU-only torch first: the default wheel bundles CUDA and is several GB larger.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

USER user

# Bake the embedding model into the image so a (re)start doesn't download it before taking traffic.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

COPY --chown=user . .

EXPOSE 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
