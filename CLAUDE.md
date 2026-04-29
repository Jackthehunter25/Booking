# Kennesaw Standard — Project Instructions

## Stack
- Pure HTML/CSS/JavaScript — no framework, no build step, no npm packages
- Backend: Supabase (Postgres + Auth + Edge Functions)
- Hosting: Vercel (auto-deploys from GitHub on push)
- Live site: https://kennesaw-standard.com

## Key Files
- `index.html` — customer-facing booking site
- `admin.html` — password-protected admin dashboard (/admin)
- `supabase/functions/notify-booking/index.ts` — edge function for email/SMS notifications

## Deployment
After completing all requested changes and confirming everything is done, always:
1. `git add -A`
2. `git commit -m "<short description of what changed>"`
3. `git push`

Only push once at the end — not after every individual file edit. If the user is still asking for more changes, keep working and push when fully finished.

Git path: `C:\Program Files\Git\cmd\git.exe`
