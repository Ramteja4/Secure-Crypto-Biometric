# Biometric authentication (full stack)

Web app for registration and login with **email**, **bcrypt-hashed password**, and **fingerprint image**. Fingerprint files are **encrypted at rest** (Fernet / AES) in MongoDB. Login compares the uploaded image to the decrypted enrollment image using **OpenCV ORB**; a **match score** above a configurable threshold is required before a **JWT** is returned.

## Stack

- **Backend:** FastAPI, Motor (MongoDB), bcrypt, `cryptography` (Fernet), OpenCV ORB, python-jose (JWT)
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Axios, React Router

## Prerequisites

- Python 3.12+ (3.11+ should work)
- Node.js 20+
- MongoDB running locally **or** Docker

## Quick start (local)

### 1. MongoDB

```bash
# Option A: Docker
docker run -d -p 27017:27017 --name biometric-mongo mongo:7

# Option B: existing MongoDB on localhost
```

### 2. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Generate secrets:

```bash
python -c "from cryptography.fernet import Fernet; print('FERNET_KEY=' + Fernet.generate_key().decode())"
```

Copy `backend/.env.example` to `backend/.env` and set at least:

- `FERNET_KEY` — output from the command above  
- `JWT_SECRET` — long random string  
- `MONGODB_URI` — default `mongodb://localhost:27017`  

Run API (from `backend`):

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open interactive docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs). JSON endpoints are `POST /register`, `POST /login`, `GET /health`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/register`, `/login`, and `/health` to `http://127.0.0.1:8000`.

## Docker Compose (API + MongoDB)

From the repository root, set `FERNET_KEY` in your environment (or a `.env` file next to `docker-compose.yml`):

```bash
set FERNET_KEY=your-fernet-key-here
docker compose up --build
```

API: [http://localhost:8000](http://localhost:8000). Run the frontend separately with `npm run dev` and point it at the API (proxy already matches port 8000).

## API summary

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness |
| POST | `/register` | `multipart/form-data`: `email`, `password`, `fingerprint` (file) |
| POST | `/login` | Same fields; returns JWT + `match_score` on success |

### Response shape

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "access_token": "...",
    "token_type": "bearer",
    "match_score": 142,
    "threshold": 30
  }
}
```

On fingerprint failure (HTTP 403), `data` may include `match_score` and `threshold`.

## Postman

Import `postman/Biometric_Auth.postman_collection.json`. Set collection variable `baseUrl` if needed. For **Register** and **Login**, choose a real image file for the `fingerprint` field (see below).

### cURL examples

Register:

```bash
curl -X POST http://127.0.0.1:8000/register ^
  -F "email=user@example.com" ^
  -F "password=password123" ^
  -F "fingerprint=@C:\path\to\fingerprint.png"
```

Login:

```bash
curl -X POST http://127.0.0.1:8000/login ^
  -F "email=user@example.com" ^
  -F "password=password123" ^
  -F "fingerprint=@C:\path\to\fingerprint.png"
```

(Use `\` instead of `^` on macOS/Linux.)

## Test images and expectations

- **Best results:** Use the **same** PNG/JPEG file (or a second photo of the **same** finger with similar lighting) for register and login.
- **ORB** counts feature matches; compression, crop, blur, or a **different** finger usually lowers the score below the threshold.
- For demos without a scanner, use any **grayscale ridge-like** image (e.g. public-domain fingerprint samples). Save two copies: register with `A.png`, login with `A.png` or a lightly edited copy.
- Tune **`FINGERPRINT_MATCH_THRESHOLD`** in `.env` if your images consistently score lower (trade-off: higher threshold is stricter).

## Security notes

- This is a **reference implementation**. Production systems should use certified matchers, liveness detection, and threat modeling.
- Never commit real `.env` files or Fernet/JWT secrets.
- Fingerprint **templates** in DB are encrypted; matching still requires decrypting server-side for ORB comparison (descriptor path reduces exposure vs. raw image when used).

## Project layout

```
backend/app/     — FastAPI app (routes, services, models, database)
frontend/src/    — React UI (Register, Login, Home, api client)
postman/         — Postman collection
```
