import os
from pathlib import Path

from huggingface_hub import HfApi, upload_folder


ROOT_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT_DIR / "model_package"
REPO_ID = os.environ.get("HF_MODEL_ID")
HF_TOKEN = os.environ.get("HF_TOKEN")


if not REPO_ID:
    raise SystemExit("Isi environment variable HF_MODEL_ID, contoh: username/mbg-sentiment-indobert")

if not HF_TOKEN:
    raise SystemExit("Isi environment variable HF_TOKEN dari Hugging Face Access Token")

api = HfApi(token=HF_TOKEN)
api.create_repo(repo_id=REPO_ID, repo_type="model", exist_ok=True)

upload_folder(
    repo_id=REPO_ID,
    repo_type="model",
    folder_path=str(MODEL_DIR),
    token=HF_TOKEN,
)

print(f"Model berhasil diupload ke https://huggingface.co/{REPO_ID}")
