# LearnMate JEE

AI-powered JEE Main & JEE Advanced study workbench, 75-question NTA Computer-Based Test (CBT) simulator, 58-chapter syllabus workspace, and spaced-repetition revision system.

---

## Architecture Overview (Vercel + Render + Firebase)

LearnMate JEE runs cleanly as a split-origin or unified deployment:

- **Frontend (Vercel Static SPA)**: Vite + React 19 + Tailwind CSS + Three.js + KaTeX + `pdfjs-dist`.
  - Root `vercel.json` proxies `/api/*` HTTP requests directly to your Render backend (`https://YOUR_RENDER_BACKEND.onrender.com/api/$1`) and rewrites all client routes to `/index.html`.
  - **Important (WebSockets)**: Vercel rewrites do **not** proxy WebSocket upgrades. Set `VITE_WS_BASE_URL=wss://YOUR_RENDER_BACKEND.onrender.com` in Vercel environment variables so the **Live Voice Tutor** (`/api/live`) connects directly to Render over `wss://`.
- **Backend (Render Express + WebSocket Server)**: `server.ts` serves all `/api/*` routes, `/api/health`, `/api/live` WebSockets, Gemini 3.x routing with multi-model fallback, and authoritative server-side CBT answer verification/grading.
- **Auth & Persistence (Firebase Auth + Firestore)**:
  - Instant password-less **Continue with Google** (`signInWithPopup` with automatic `signInWithRedirect` fallback for mobile browsers) and automatic `/users/{uid}` Firestore profile upsert.
  - Email/Password Sign-In, Create Account, and inline **Forgot Password?** (`sendPasswordResetEmail`).
  - Explicit **Try Demo Without Account** preview mode (no silent production guest bypass; `ALLOW_DEV_AUTH_BYPASS=false`).

---

## Gemini Model Routing & Resilient Fallback Chain

All server-side `@google/genai` calls in `src/server/coreStudyEngine.ts`, `src/server/routes/aiTutorRoutes.ts`, and `src/server/ws/voiceLiveServer.ts` read model IDs from `process.env` and wrap `generateContent` in `generateWithModelFallback(models, invoke)`:

| Environment Variable | Default Model | Purpose |
| --- | --- | --- |
| `GEMINI_MODEL_FAST` | `gemini-3.5-flash-lite` | Ultra-fast doubt solving, OCR, and quiz generation |
| `GEMINI_MODEL_THINKING` | `gemini-3.8-flash` | Complex JEE Advanced derivations & reasoning |
| `GEMINI_MODEL_ANALYZE` | `gemini-3.8-flash` | Multimodal PDF / handwritten note analysis |
| `GEMINI_MODEL_LIVE` | `gemini-3.8-live` | Real-time WebSocket Voice Tutor |

When a primary model returns `404` (unavailable) or `429` (rate limit), `generateWithModelFallback` automatically cascades:

```
gemini-3.8-flash  ->  gemini-3.6-flash  ->  gemini-3.5-flash-lite
```

---

## Deployment Checklist

### 1. Render (Backend Web Service)
`render.yaml` is preconfigured for Render:
- **Build Command**: `npm ci && npm run build`
- **Start Command**: `npm start` (`tsx server.ts`)
- **Health Check Path**: `/api/health`
- Required environment variables on Render:
  - `GEMINI_API_KEY`
  - `FIREBASE_PROJECT_ID` / `FIREBASE_SERVICE_ACCOUNT_JSON`
  - `APP_PUBLIC_URL` (your Vercel URL, e.g. `https://your-app.vercel.app`)
  - `CORS_ALLOWED_ORIGINS` (comma-separated allowed origins, e.g. `https://your-app.vercel.app`)
  - `ALLOW_DEV_AUTH_BYPASS=false`
  - `TRUST_PROXY=true`

### 2. Vercel (Frontend)
1. Replace `https://YOUR_RENDER_BACKEND.onrender.com` in `vercel.json` with your actual Render service URL.
2. Configure environment variables in Vercel Project Settings:
   - `VITE_API_BASE_URL` (optional; leave empty `""` to use `vercel.json` `/api/*` rewrite proxy)
   - `VITE_WS_BASE_URL=wss://YOUR_RENDER_BACKEND.onrender.com`
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`
   - `VITE_ADMIN_EMAILS` (optional comma-separated admin emails for Question Bank / Commercial Consoles)

### 3. Firebase Console Setup
1. **Authentication -> Settings -> Authorized domains**:
   - Add your Vercel production domain (e.g. `your-app.vercel.app`), custom domain, and `localhost`.
2. **Authentication -> Sign-in method**:
   - Enable **Google** and **Email/Password**.
3. **Firestore Rules**:
   - Deploy `firestore.rules` (`firebase deploy --only firestore:rules`). Client-side `plan` writes are locked to `'free'` on creation and immutable on updates.

---

## 58 NTA Chapters & PYQ Security Model

- `src/data/expandedNta58Chapters.ts` defines the full **58-chapter JEE syllabus** across Physics, Chemistry, and Mathematics.
- Static PYQ packs in `public/pyq-packs/jee-main-shifts.json` and `public/pyq-packs/jee-advanced-papers.json` cover **2020–2026** shifts and are **strictly stripped** of `correctIndex`, `correctIndices`, `numericalAnswer`, and `explanation`.
- All answers and detailed LaTeX solutions live exclusively on the server in `src/server/data/authoritativeAnswerKeys.ts` and are verified via `/api/pyq/verify-answer` and `/api/cbt/grade`.

---

## Local Development, Tests & Verification

```bash
# Install dependencies
npm install

# Run full development server (Express + Vite middleware on port 3000)
npm run dev

# Type-check & production build
npm run lint
npm run build

# Run unit & security tests (including Firestore rules audit)
npm run test
npm run audit:rules
```
