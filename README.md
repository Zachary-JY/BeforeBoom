# BeforeBoom (崩前慢)

> **Notice the signal. Choose your next move.**  
> **察觉压力信号，自主选择下一步。**

**Live Demo:** [https://beforeboom.ai.studio](https://beforeboom.ai.studio)

---

## Overview

**BeforeBoom** is a multimodal stress-signal awareness and closed-loop intervention web application built for students and knowledge workers juggling overlapping study, work, and custom project deadlines. Rather than diagnosing emotions or prescribing rigid advice, BeforeBoom helps users gently notice rising stress signals relative to their personal baseline, inspect transparent observable evidence, choose how they want support, and verify whether the intervention actually helped.

---

## Real-World Problem

During intense exam weeks, coding sprints, and hackathons, students often push past early physiological and cognitive overload until they hit burnout or freeze completely ("boom"). Existing wellness apps either interrupt with generic pop-ups, make opaque diagnostic claims, or require lengthy journaling when a user is already overwhelmed.

BeforeBoom solves this with a **cautious, agency-first 6-stage closed loop**:
1. **Setup & Sensor Connection** — Choose context (`Study`, `Work`, or `Custom`), set an observation window, and connect real microphone, camera, and wearable heart-rate channels.
2. **Live Multimodal Observation** — Continuously synthesize spoken/typed words, heart rate & HRV relative to personal baseline, and camera facial micro-expressions into a real-time **Multimodal State Trajectory Chart**.
3. **Support Choice** — Review transparent "What we noticed" evidence and choose between **Listen**, **Regulate**, **Plan**, or **I'm okay** (dismiss with cooldown).
4. **Targeted Intervention** —
   - **Listen:** Brief, context-aware conversational reflection (`Just listen`, `Help me settle`, or `Find a next step`).
   - **Regulate:** A 45-second guided breathing pacer (`4s inhale · 2s hold · 6s exhale`) plus 1-minute interactive decompression mini-games (Bubble Pop & Floating Cloud Release).
   - **Plan:** Breaks an overwhelming task into a single 20-minute executable step, a clear completion condition, and a "set aside for now" list.
5. **Verification** — Confirm whether things feel `Better`, `Same`, or `Worse`, with one-click ability to switch support modes or return to observation.
6. **Summary & Personal History** — Review the full session trajectory and save records to a persistent **Multimodal History & Personal Trends** archive (`localStorage`).

---

## Role of Gemini (`@google/genai`)

All Gemini calls are executed server-side in `server.ts` using the `@google/genai` SDK (`gemini-4-argon`) with deterministic local fallbacks (`src/lib/beforeboomEngine.ts`) so the app remains 100% responsive even offline or under rate limits:

1. **Multimodal Signal & Support Router (`POST /api/analyze-signal`)**
   - Uses structured JSON schema output (`responseSchema`) to synthesize recent user transcripts/notes, wearable BPM/HRV deltas against baseline, and camera facial micro-expression cues into cautious, non-diagnostic evidence bullets and a recommended support mode (`Listen`, `Regulate`, or `Plan`).
2. **Live Camera Facial Micro-Expression Analysis (`POST /api/analyze-face`)**
   - Analyzes live webcam JPEG frames via `gemini-4-argon` multimodal vision to identify observable brow tension, lip curvature, and eye fatigue without diagnostic overreach.
3. **Live Microphone Audio Transcription (`POST /api/transcribe-audio`)**
   - Transcribes recorded WebM/MP4 voice snippets via `gemini-4-argon` audio understanding when browser Web Speech API is unavailable.
4. **20-Minute Micro-Step Planner (`POST /api/generate-plan`)**
   - Generates structured JSON action cards (`priorityTask`, `next20MinutesAction`, `completionCondition`, `setAsideList`) tailored to the user's active task and supports instant re-scoping into smaller steps.
5. **Contextual Listen Companion (`POST /api/listen-reply`)**
   - Produces concise (1–2 sentence) grounded reflections or single questions based on the user's task and selected sub-mode (`Just listen`, `Help me settle`, `Find a next step`).

---

## Key Implemented Features

- **Real Hardware & Multimodal Inputs:**
  - **Microphone:** Browser Web Speech API (`SpeechRecognition`) + `MediaRecorder` audio snippet transcription via Gemini.
  - **Camera:** Live `getUserMedia` video stream for facial micro-expression analysis + real-time **Camera Optical Pulse (rPPG)** green-channel photoplethysmography for contact-based BPM/HRV measurement.
  - **Wearables:** Real **Web Bluetooth GATT (`0x180D` / `0x2A37`)** heart-rate & RR-interval parser, plus a **Cross-Device Companion Webhook (`POST /api/wearable/push`)** for Apple Watch iOS Shortcuts or mobile health bridges.
- **Interactive Multimodal State Trajectory Chart:**
  - Multi-track SVG timeline displaying Composite Stress Index (`0–100`), Wearable BPM & HRV (`RMSSD ms`), Camera Facial Tension (`0–100%`), Voice/Text Keyword Intensity, and interactive event pins.
- **Real-Time Companion Pet ("Mochi / 小团子"):**
  - Automatically mirrors observable multimodal cues (`calm`, `happy`, `anxious`, `sad`, `relieved`) without manual mood toggles.
- **Smartwatch High-Stress Alert Overlay:**
  - Triggers when HRV drops sharply below personal baseline or BPM spikes, offering a 1-tap transition to guided breathing.
- **Full Flow Control & Strict Bilingual Purity (`中文 / English`):**
  - Global 6-step flow stepper bar and in-card navigation allow users to skip any countdown timer, step backward, or jump to the summary at any time.
  - Instant toggle between 100% pure Simplified Chinese and 100% pure English.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Vite 8
- **Backend:** Node.js (v22+), Express 4 (`server.ts`)
- **AI SDK:** Google GenAI SDK (`@google/genai` — `gemini-4-argon`)
- **Testing:** Node.js built-in test runner (`node:test` via `tsx`)

---

## Getting Started (Local Setup)

### 1. Prerequisites
- **Node.js** v22+ and **npm**
- A **Gemini API Key** from Google AI Studio (optional for local testing; the app automatically falls back to its built-in deterministic engine if omitted)

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` and add your Gemini API key:
```bash
cp .env.example .env
```
Edit `.env`:
```env
GEMINI_API_KEY="your_actual_gemini_api_key_here"
APP_URL="http://localhost:3000"
```

### 4. Run in Development Mode
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Run Unit Tests, Type Check & Production Build
```bash
npm test
npm run lint
npm run build
npm start
```
