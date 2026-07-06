import json
import mimetypes
import os
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import torch
from huggingface_hub import hf_hub_download
from transformers import AutoConfig, AutoModelForSequenceClassification, AutoTokenizer


ROOT_DIR = Path(__file__).resolve().parent
MODEL_DIR = ROOT_DIR / "model_package"
STATIC_DIR = ROOT_DIR / "static"
PORT = int(os.environ.get("PORT", "8000"))
HOST = os.environ.get("HOST", "0.0.0.0")
HF_MODEL_ID = os.environ.get("HF_MODEL_ID", "").strip()
HF_TOKEN = os.environ.get("HF_TOKEN") or None
MODEL_SOURCE = HF_MODEL_ID or str(MODEL_DIR)
LOCAL_MODEL_FILE = MODEL_DIR / "model.safetensors"
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
]


def validate_model_source():
    if HF_MODEL_ID or LOCAL_MODEL_FILE.exists():
        return

    raise RuntimeError(
        "Model checkpoint tidak ditemukan. Set HF_MODEL_ID di environment Railway "
        "ke repo Hugging Face kamu, atau jalankan lokal dengan model_package/model.safetensors."
    )


def load_metadata():
    if HF_MODEL_ID:
        try:
            metadata_path = hf_hub_download(
                repo_id=HF_MODEL_ID,
                filename="metadata.json",
                token=HF_TOKEN,
            )
            with open(metadata_path, "r", encoding="utf-8") as file:
                return json.load(file)
        except Exception:
            config = AutoConfig.from_pretrained(MODEL_SOURCE, token=HF_TOKEN)
            labels = {
                str(key): value.lower()
                for key, value in getattr(config, "id2label", {}).items()
            }
            return {
                "model_name": HF_MODEL_ID,
                "base_model": HF_MODEL_ID,
                "labels": labels,
                "max_length": int(os.environ.get("MODEL_MAX_LENGTH", "160")),
            }

    with (MODEL_DIR / "metadata.json").open("r", encoding="utf-8") as file:
        return json.load(file)


validate_model_source()
METADATA = load_metadata()
ID_TO_LABEL = {int(key): value for key, value in METADATA["labels"].items()}
LABEL_INFO = {
    "positif": {
        "title": "Positif",
        "description": "Komentar menunjukkan dukungan, apresiasi, atau pengalaman baik terhadap MBG.",
    },
    "netral": {
        "title": "Netral",
        "description": "Komentar bersifat informatif, deskriptif, atau belum menunjukkan emosi yang kuat.",
    },
    "negatif": {
        "title": "Negatif",
        "description": "Komentar memuat kritik, keluhan, kekhawatiran, atau penolakan terhadap MBG.",
    },
}

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
TOKENIZER = AutoTokenizer.from_pretrained(MODEL_SOURCE, token=HF_TOKEN)
MODEL = AutoModelForSequenceClassification.from_pretrained(MODEL_SOURCE, token=HF_TOKEN)
MODEL.to(DEVICE)
MODEL.eval()


def predict_sentiment(text):
    inputs = TOKENIZER(
        text,
        max_length=METADATA["max_length"],
        truncation=True,
        padding="max_length",
        return_tensors="pt",
    )
    inputs = {key: value.to(DEVICE) for key, value in inputs.items()}

    with torch.no_grad():
        logits = MODEL(**inputs).logits
        probabilities = torch.softmax(logits, dim=-1)[0]

    predicted_id = int(torch.argmax(probabilities).item())
    label = ID_TO_LABEL[predicted_id]
    distribution = {
        ID_TO_LABEL[index]: round(float(probabilities[index].item()) * 100, 2)
        for index in range(len(ID_TO_LABEL))
    }

    return {
        "label": label,
        "labelTitle": LABEL_INFO[label]["title"],
        "description": LABEL_INFO[label]["description"],
        "confidence": distribution[label],
        "probabilities": distribution,
        "model": METADATA["model_name"],
        "baseModel": "BERT",
        "device": str(DEVICE).upper(),
        "time": datetime.now().strftime("%H:%M:%S"),
    }


class SentimentHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_common_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/":
            self.serve_file(STATIC_DIR / "index.html", "text/html; charset=utf-8")
            return

        if path == "/dashboard":
            self.serve_file(STATIC_DIR / "dashboard.html", "text/html; charset=utf-8")
            return

        if path == "/health":
            self.send_json(
                {
                    "status": "ok",
                    "model": METADATA["model_name"],
                    "modelSource": HF_MODEL_ID or "local",
                }
            )
            return

        requested = (STATIC_DIR / path.lstrip("/")).resolve()
        if STATIC_DIR in requested.parents and requested.exists() and requested.is_file():
            content_type = mimetypes.guess_type(requested.name)[0] or "application/octet-stream"
            self.serve_file(requested, content_type)
            return

        self.send_error(404, "Halaman tidak ditemukan")

    def do_POST(self):
        if urlparse(self.path).path != "/api/predict":
            self.send_error(404, "Endpoint tidak ditemukan")
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            text = str(payload.get("text", "")).strip()
            if not text:
                self.send_json({"error": "Masukkan komentar MBG terlebih dahulu."}, status=400)
                return

            result = predict_sentiment(text)
            result["text"] = text
            self.send_json(result)
        except json.JSONDecodeError:
            self.send_json({"error": "Format JSON tidak valid."}, status=400)
        except Exception as exc:
            self.send_json({"error": f"Prediksi gagal: {exc}"}, status=500)

    def serve_file(self, file_path, content_type):
        data = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_common_headers()
        self.end_headers()
        self.wfile.write(data)

    def send_json(self, payload, status=200):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_common_headers()
        self.end_headers()
        self.wfile.write(data)

    def send_common_headers(self):
        origin = self.headers.get("Origin")
        if "*" in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", "*")
        elif origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), SentimentHandler)
    print(f"MBG Sentiment Analysis berjalan di http://{HOST}:{PORT}")
    print(f"Model: {METADATA['model_name']} | Device: {DEVICE}")
    server.serve_forever()
