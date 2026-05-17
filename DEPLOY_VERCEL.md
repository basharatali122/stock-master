# Deploy to Vercel (Frontend) + Lovable Cloud (Backend)

Your Lovable Cloud backend (database, auth, edge functions) stays exactly where it is. Only the frontend moves to Vercel.

## 1. Push code to GitHub
In Lovable: top-right → GitHub → Connect project → Create Repository.

## 2. Import the repo in Vercel
- vercel.com → **Add New → Project** → import your GitHub repo.
- Framework Preset: **Vite** (auto-detected via `vercel.json`).
- Build Command: `npm run build`
- Output Directory: `dist`

## 3. Add Environment Variables in Vercel
In **Project Settings → Environment Variables**, add (for Production, Preview, Development):

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://nynjxldzenyjdahunpna.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55bmp4bGR6ZW55amRhaHVucG5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MDUwNjIsImV4cCI6MjA4MTk4MTA2Mn0.8UoE_3sf0u4_1CD0YrSZ6x9lFBjyCDn6PQoRQ71IMqI` |
| `VITE_SUPABASE_PROJECT_ID` | `nynjxldzenyjdahunpna` |

(Same values as your local `.env` — they are publishable keys, safe in the browser.)

## 4. Deploy
Click **Deploy**. Vercel will build and host the frontend. All API/auth/db calls still go to Lovable Cloud automatically.

## 5. (Optional) Allow the Vercel domain in Auth
If using OAuth (Google sign-in), add your Vercel URL (e.g. `https://your-app.vercel.app`) to the Auth **Site URL / Redirect URLs** in Lovable Cloud → Auth settings.

## Continuous deployment
Every push to your GitHub `main` branch (including changes made in Lovable) auto-deploys to Vercel. SPA deep-link refreshes work via the `rewrites` rule in `vercel.json`.
