# Prediksi Sentimen Komentar MBG

Aplikasi web sederhana untuk memprediksi sentimen komentar MBG dengan model IndoBERT fine-tuned.

## Arsitektur Deploy

```text
Frontend static (Vercel)
        |
        v
Vercel API proxy /api/predict
        |
        v
Backend model (Railway/Render/Azure)
        |
        v
Model IndoBERT dari Hugging Face Hub
```

Struktur ini membuat Vercel hanya menjalankan frontend dan proxy ringan. Model tetap berjalan di backend Python karena dependency `torch` dan file model lebih cocok ditempatkan di layanan backend atau Hugging Face Hub.

## Struktur

```text
api/
  predict.js
app.py
requirements.txt
README.md
scripts/
  upload_to_huggingface.py
vercel.json
model_package/
  config.json
  metadata.json
  tokenizer.json
  tokenizer_config.json
static/
```

## Menjalankan Lokal

```powershell
pip install -r requirements.txt
python app.py
```

Buka `http://127.0.0.1:8000` di browser.

## Upload Model ke Hugging Face

File `model_package/model.safetensors` tidak disimpan di GitHub karena ukurannya besar. Upload model ke Hugging Face Hub terlebih dahulu.

1. Buat token di Hugging Face:

```text
https://huggingface.co/settings/tokens
```

2. Jalankan dari terminal lokal:

```powershell
$env:HF_MODEL_ID="username/mbg-sentiment-indobert"
$env:HF_TOKEN="hf_token_kamu"
python scripts/upload_to_huggingface.py
```

Setelah sukses, model tersedia di:

```text
https://huggingface.co/username/mbg-sentiment-indobert
```

## Deploy Backend

Deploy repository ini ke Railway, Render, Google Cloud, atau Microsoft Azure sebagai service Python.

Gunakan command:

```powershell
python app.py
```

Environment variable backend:

```text
PORT=8000
HOST=0.0.0.0
ALLOWED_ORIGINS=*
HF_MODEL_ID=username/mbg-sentiment-indobert
HF_TOKEN=hf_token_kamu
```

Setelah backend aktif, pastikan endpoint ini bisa dibuka:

```text
https://URL-BACKEND-KAMU/health
```

## Deploy Frontend ke Vercel

Deploy repository yang sama ke Vercel. File `vercel.json` akan mengarahkan:

```text
/          -> static/index.html
/dashboard -> static/dashboard.html
/api/predict -> api/predict.js
```

Tambahkan environment variable di Vercel:

```text
BACKEND_URL=https://URL-BACKEND-KAMU
```

Frontend akan tetap memanggil `/api/predict`, lalu Vercel meneruskannya ke backend model.
