# BeforeBoom System Architecture

## 1. High-Level Overview

BeforeBoom is a full-stack TypeScript web application served from a single Express + Vite server (`server.ts`) on port `3000`. It combines client-side hardware Web APIs (Web Speech, MediaRecorder, getUserMedia Camera, Optical rPPG, and Web Bluetooth GATT) with a server-side **Google Gemini (`@google/genai`)** multimodal router and a deterministic local fallback engine (`src/lib/beforeboomEngine.ts`).

```text
+-----------------------------------------------------------------------------------+
|                           Browser Client (React 19 + TS)                          |
|                                                                                   |
|  +--------------------+   +------------------------+   +-----------------------+  |
|  | Hardware Sensors   |   | 6-Stage Closed Loop UI |   | Persistent Archive    |  |
|  | - Web Speech / Mic |   | 1. WelcomeView         |   | - localStorage        |  |
|  | - Webcam + rPPG    |-->| 2. LiveCheckinView     |-->|   (beforeboom_        |  |
|  | - Web Bluetooth    |   | 3. SupportChoiceView   |   |    history_v1)        |  |
|  |   GATT (0x180D)    |   | 4. Listen/Regulate/Plan|   | - HistoryDrawerModal  |  |
|  +--------------------+   | 5. VerificationView    |   +-----------------------+  |
|            |              | 6. SummaryView         |                              |
|            v              +------------------------+                              |
|  +-----------------------------------------------------------------------------+  |
|  | Pure Domain Engine (src/lib/beforeboomEngine.ts)                            |  |
|  | - BLE 0x2A37 packet parser & Optical rPPG BPM/HRV signal processor          |  |
|  | - Multimodal Timeline Series builder (MultimodalTimelineChart.tsx)          |  |
|  | - Cautious baseline evaluator, Smartwatch alert & Mochi mood detector       |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------|-----------------------------------------+
                                          | REST JSON (/api/*)
                                          v
+-----------------------------------------------------------------------------------+
|                        Express Server (server.ts, Port 3000)                      |
|                                                                                   |
|  - GET  /api/health            -> AI key status & privacy retention policy        |
|  - POST /api/wearable/push     -> Cross-device Apple Watch / Companion webhook    |
|  - GET  /api/wearable/live     -> Polls latest cross-device wearable telemetry    |
|  - POST /api/transcribe-audio  -> Gemini audio snippet transcription              |
|  - POST /api/analyze-face      -> Gemini camera frame micro-expression analysis   |
|  - POST /api/analyze-signal    -> Gemini structured Signal & Support Router       |
|  - POST /api/generate-plan     -> Gemini 20-minute micro-step JSON generator      |
|  - POST /api/listen-reply      -> Gemini contextual Listen companion response     |
|                                         |                                         |
|                                         v                                         |
|                    Google GenAI SDK (@google/genai, gemini-3.8-flash)             |
|                    (Server-side GEMINI_API_KEY + automatic local fallback)        |
+-----------------------------------------------------------------------------------+
```

---

## 2. Frontend Architecture (`src/`)

### State & Closed-Loop Orchestration (`src/App.tsx`)
`App.tsx` manages the active session state across the 6 closed-loop stages (`welcome` → `live_checkin` → `support_choice` → `listen` | `regulate` | `plan` → `verification` → `summary`) and coordinates:
- Real-time hardware streams (Microphone `SpeechRecognition` / `MediaRecorder`, Webcam `MediaStream`, and Web Bluetooth `BluetoothRemoteGATTServer`).
- Automatic synchronization with the **Companion Pet (`CompanionPet.tsx`)** and **Smartwatch Alert Overlay (`SmartwatchAlertModal.tsx`)**.
- Non-blocking flow navigation via the global stepper in `Header.tsx` and in-card skip/back controls so users are never locked into countdown timers.

### Core UI Components (`src/components/`)
- **`Header.tsx`:** Displays live signal status (`Settled`, `Signals rising`, `Elevated signals`), AI router status, History Drawer trigger with badge count, strict `中文 / English` toggle, and the 6-step interactive flow stepper bar.
- **`WelcomeView.tsx`:** Handles persona selection/customization, activity context (`Study`, `Work`, `Custom`), observation duration selection, and real pre-session device connections (Microphone, Camera, Web Bluetooth GATT `0x180D`, Camera Optical rPPG, and Apple Watch / Companion webhook push).
- **`LiveCheckinView.tsx`:** Renders the quiet observation workspace, real-time **Multimodal State Trajectory Chart (`MultimodalTimelineChart.tsx`)**, "What we noticed" evidence card, live camera feed with micro-expression telemetry, voice/text input log, and wearable BPM/HRV trend cards.
- **`MultimodalTimelineChart.tsx`:** Multi-track interactive SVG visualization plotting Composite Stress Index (`0–100`), Heart Rate (`BPM`), Heart Rate Variability (`RMSSD ms`), Camera Facial Tension (`0–100%`), and Voice/Text Stress Keyword Intensity over the observation window.
- **`SupportChoiceView.tsx`:** Presents transparent evidence and the four user choices (`Listen`, `Regulate`, `Plan`, `I'm okay` with optional reason and cooldown).
- **`ListenView.tsx`, `RegulateView.tsx`, `PlanView.tsx`:** Execute the user's chosen intervention:
  - `ListenView.tsx`: Contextual chat with selectable sub-modes (`Just listen`, `Help me settle`, `Find a next step`).
  - `RegulateView.tsx`: 45-second guided breathing animation + 60-second Bubble Pop and Cloud Release decompression mini-games.
  - `PlanView.tsx`: 20-minute micro-step card with one-click step re-scoping and focus timer.
- **`VerificationView.tsx` & `SummaryView.tsx`:** Capture post-intervention feedback (`Better`, `Same`, `Worse`), adjust baseline/cooldown state, and present a full trajectory review.
- **`HistoryDrawerModal.tsx`:** Displays cross-session aggregate KPIs (total sessions, average stress drop, average HRV recovery, top support mode), a Peak vs. Post-Support comparison bar chart, and full timeline replay for every saved session.

---

## 3. Pure Domain Logic & Deterministic Fallback (`src/lib/beforeboomEngine.ts`)

All signal evaluation, hardware packet parsing, and fallback text generation are decoupled into pure, unit-tested functions in `src/lib/beforeboomEngine.ts` (tested in `src/lib/beforeboomEngine.test.ts`):
- **`parseBleHeartRateMeasurement`:** Decodes raw Bluetooth GATT `0x2A37` byte arrays (8-bit/16-bit BPM flags and 1/1024s RR-intervals) into BPM, baseline delta, and RMSSD HRV (`ms`).
- **`computeOpticalRppgMetrics`:** Processes green-channel (`G`) photoplethysmography frame samples using peak detection to compute real optical pulse BPM and HRV when a finger is placed over the camera lens.
- **`evaluateSignalState`:** Combines stress keyword density, BPM delta, HRV drop, and camera facial tension into cautious, non-diagnostic evidence bullets in pure Chinese or pure English.
- **`buildMultimodalTimelineSeries`:** Normalizes time-series telemetry across all active channels into unified `MultimodalTimelinePoint` records for `MultimodalTimelineChart.tsx`.

---

## 4. Server-Side Gemini Integration & Security (`server.ts`)

- **Zero Client Key Exposure:** `GEMINI_API_KEY` is read strictly inside `server.ts` via `process.env.GEMINI_API_KEY`. The browser never receives or stores the API key.
- **Structured Output & Language Guardrails:** Endpoints `/api/analyze-signal`, `/api/analyze-face`, and `/api/generate-plan` enforce strict JSON schemas (`Type.OBJECT`) with `gemini-3.8-flash` and verify language purity before returning responses.
- **Resilient Degrade-Gracefully Design:** Every Gemini API route falls back seamlessly to `beforeboomEngine.ts` if `GEMINI_API_KEY` is unconfigured or if an upstream network error occurs, guaranteeing uninterrupted live demonstrations.
