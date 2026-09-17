# CNHS Learn — Deploy Random Forest (ml-service) so production does not use fallback

Next.js on **Vercel** cannot keep sklearn/FastAPI running. Host `ml-service` separately, then set `RF_INFERENCE_URL` on Vercel.

**Local:** `RF_INFERENCE_URL=http://127.0.0.1:8000` + `npm run ml:serve` (or `npm run dev:all`).

---

## What you deploy

| Piece | Host | Env |
|-------|------|-----|
| CNHS Learn (Next.js) | Vercel | `RF_INFERENCE_URL=https://your-ml-host` |
| Academic Risk RF (FastAPI) | Railway / Render / Fly / Cloud Run | Optional `RF_INFERENCE_API_KEY` |

Artifact included in the image: `ml-service/artifacts/random_forest_academic_risk.joblib`.

Start command (Docker already sets this):

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Health: `GET https://your-ml-host/health` → `"model_loaded": true`.

---

## Railway (recommended simple path)

1. New project → **Deploy from GitHub** (this repo).  
2. Set **Root Directory** to `ml-service` (or use Dockerfile path `ml-service/Dockerfile`).  
3. Railway detects Dockerfile; deploy.  
4. Generate a public HTTPS domain.  
5. Open `/health` — confirm `model_loaded: true`.  
6. Copy base URL only, e.g. `https://cnhs-rf-production.up.railway.app`  
   (**no** `/predict` suffix).

Optional: set `RF_INFERENCE_API_KEY` in Railway; use the **same** value on Vercel.

---

## Render

1. New **Web Service** → this repo.  
2. Runtime: **Docker**; Dockerfile path `ml-service/Dockerfile` (context `ml-service`).  
   Or use `ml-service/render.yaml` Blueprint.  
3. Health check path: `/health`.  
4. Deploy → copy `https://….onrender.com` (no `/predict`).

Free tier may cold-start; first Monitoring load can be slow — if timeout, raise `RF_INFERENCE_TIMEOUT_MS` / batch timeout on Vercel.

---

## Vercel (Next.js)

1. Project → **Settings → Environment Variables**.  
2. Add for Production (and Preview if you want RF there too):

```text
RF_INFERENCE_URL=https://your-ml-host
```

Optional:

```text
RF_INFERENCE_API_KEY=same-secret-as-ml-service
RF_INFERENCE_TIMEOUT_MS=8000
RF_INFERENCE_BATCH_TIMEOUT_MS=30000
```

3. **Redeploy** the Next.js app (env changes need a new deployment).  
4. Do **not** rely on `http://127.0.0.1:8000` in Vercel — that only works on your PC.

Prefer **server-only** `RF_INFERENCE_URL` (not `NEXT_PUBLIC_…`) so the ML URL stays off the browser bundle.

---

## Checklist — RF live (no amber fallback)

1. Deploy `ml-service` → note HTTPS base URL.  
2. `GET {URL}/health` → `model_loaded: true`.  
3. Set Vercel `RF_INFERENCE_URL={URL}` (no trailing slash / no `/predict`).  
4. Redeploy Next.js.  
5. Sign in as teacher or Head Teacher → open **Academic Monitoring**.  
6. Confirm there is **no** amber banner: *“Prediction service unavailable / rule-based fallback”*.  
7. Optional: DevTools → Network → `/api/recommendations/predict-batch` response `source` should be `random-forest` (not `rule-based-fallback`).

If the amber banner still shows: ML down, wrong URL, CORS not needed (server-to-server), timeout, or env not on the deployment you are testing.

---

## Local

```bash
# .env.local
RF_INFERENCE_URL=http://127.0.0.1:8000

# Terminal A + B, or one command:
npm run dev:all
```

Requires `ml-service/.venv` with `pip install -r requirements.txt` once.

---

## Optional API key

If `RF_INFERENCE_API_KEY` is set on the ML service, requests must send:

`Authorization: Bearer <key>`

CNHS Learn already sends this when the same env var is set on the Next.js server (`lib/services/recommendation/inferenceClient.js`).
