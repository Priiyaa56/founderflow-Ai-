# FounderFlow AI

A warm, nude-toned AI business operations assistant for the Amazon Build, Ship, Shape hackathon.

## What's included
- React + Vite frontend with warm nude / terracotta styling
- Light and dark mode toggle (saved in local storage)
- Responsive dashboard, lead cards, assistant chat, task list, activity feed
- Add leads from the Overview or Leads page, view lead details, draft a follow-up, and remove leads
- Add, complete, and remove tasks; working navigation, theme toggle, and feedback notifications
- Slightly increased typography and clearer interactive states
- Express backend with sample leads and working demo workflows
- Gemini API integration for live, personalized follow-up drafts with visible API errors (no silent demo-draft fallback when Gemini fails)
- Demo mode works without API keys or Supabase
- Approval / rejection actions for suggested follow-ups
- In-memory tasks and activity history (reset when the backend restarts)

## Requirements
- Node.js 18+ (Node.js 20+ recommended)
- npm

## Run locally

### 1. Start backend
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```
The backend runs at `http://localhost:5000`.

On Windows PowerShell, if `cp` doesn't work:
```powershell
Copy-Item .env.example .env
```

### 2. Start frontend in another terminal
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
Open the URL printed by Vite, usually `http://localhost:5173`.

The frontend defaults to `http://localhost:5000` for the API.

## Optional Gemini API
1. Get a key at https://aistudio.google.com/
2. Put it in `backend/.env`:
```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
```
Restart the backend. Follow-up drafting requires a valid key and a successful Gemini request. If the request fails, the app shows the error rather than silently substituting a generic demo email. Never put the Gemini key in the frontend. Do not upload or commit `backend/.env`.

## Deploying
Deploy frontend and backend as separate projects.

### Backend on Vercel
- Import the `backend` folder as its own Vercel project.
- Add environment variables `GEMINI_API_KEY` (optional) and `GEMINI_MODEL` (optional).
- The included `vercel.json` configures the Express entrypoint.
- After deploying, check `https://YOUR-BACKEND-URL/api/health`.

### Frontend on Vercel
- Import the `frontend` folder as another Vercel project.
- Add environment variable:
  `VITE_API_URL=https://YOUR-BACKEND-URL`
- Deploy, then test the chat and approval flow.

Note: this starter uses in-memory demo data. On serverless hosting, state may reset between requests/instances. For a reliable public production deployment, connect a persistent database such as Supabase. Supabase is not required for the hackathon demo to run.

## Hackathon submission reminders
- Verify the event's current rules and deadline in the official Devpost page.
- Add a public GitHub repository and an open-source license if required.
- Record a demo video that follows the event's duration rules.
- Clearly disclose that the Alexa+ experience is simulated if that is the implementation approach.
