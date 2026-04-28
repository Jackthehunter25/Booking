# Kennesaw Standard Exterior Co. — Setup Guide

Follow these steps in order. Takes about 30–45 minutes total.

---

## STEP 1 — Supabase (Database)

### 1a. Create a project
1. Go to https://app.supabase.com
2. Click **New Project**
3. Name it `kennesaw-standard`, pick any password, choose `us-east-1`
4. Wait ~2 minutes for it to spin up

### 1b. Create the bookings table
In the left sidebar → **SQL Editor** → paste and run this:

```sql
create table bookings (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  service     text not null,
  details     jsonb,
  name        text not null,
  email       text not null,
  phone       text not null,
  address     text not null,
  date        text,
  time        text,
  addons      text[],
  referral    text,
  gate_code   text,
  price_estimate text,
  status      text default 'pending'
);

-- Allow public inserts (booking form doesn't require login)
alter table bookings enable row level security;

create policy "Allow public insert"
  on bookings for insert
  with check (true);

-- Only authenticated users (you) can read bookings
create policy "Allow authenticated read"
  on bookings for select
  using (auth.role() = 'authenticated');
```

### 1c. Get your API keys
1. Left sidebar → **Project Settings** → **API**
2. Copy:
   - **Project URL** (looks like `https://xyzabc.supabase.co`)
   - **anon public** key (the long one starting with `eyJ`)
3. Open `index.html` and replace the two placeholder values at the top:

```js
const SUPABASE_URL  = 'https://your-project.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

> ✅ The anon key is safe to put in frontend code — it only has permission to INSERT bookings, not read them.
> ❌ NEVER put the `service_role` secret key in frontend code.

---

## STEP 2 — Twilio (SMS Notifications)

### 2a. Create a Twilio account
1. Go to https://www.twilio.com/try-twilio
2. Sign up (free trial gives you $15 credit — enough for hundreds of texts)
3. Verify your personal phone number

### 2b. Get a Twilio phone number
1. Twilio Console → **Phone Numbers** → **Buy a Number**
2. Filter by **SMS capability**, pick a local (770) number if available
3. Buy it (~$1/month)

### 2c. Get your credentials
From the Twilio Console dashboard, copy:
- **Account SID** (starts with `AC`)
- **Auth Token** (click to reveal)
- **Your Twilio number** (the one you just bought)

---

## STEP 3 — Deploy the Edge Function (SMS bridge)

> The Edge Function keeps your Twilio credentials server-side where they're safe.

### 3a. Install Supabase CLI
```bash
# Mac
brew install supabase/tap/supabase

# Windows — download from:
# https://github.com/supabase/cli/releases
```

### 3b. Log in and link your project
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
# Find your project ref in: Supabase → Project Settings → General
```

### 3c. Set your secret environment variables
```bash
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=your_auth_token_here
supabase secrets set TWILIO_FROM=+17705550199       # your Twilio number
supabase secrets set OWNER_PHONE=+17705550100       # YOUR personal cell number
```

### 3d. Deploy the function
```bash
supabase functions deploy notify-booking
```

Done. Every booking submission will now trigger an SMS to your phone.

---

## STEP 4 — Deploy to Vercel

### 4a. Push to GitHub
```bash
# In your project folder
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kennesaw-standard.git
git push -u origin main
```

### 4b. Deploy on Vercel
1. Go to https://vercel.com → **Add New Project**
2. Import your GitHub repo
3. Framework preset: **Other**
4. Click **Deploy**

That's it. Vercel auto-deploys on every `git push`.

Your live URL will be something like `kennesaw-standard.vercel.app`.

> You can add a custom domain (like `kennesaw-standard.com`) in Vercel → Project → Domains.

---

## STEP 5 — Test the full flow

1. Open your live Vercel URL
2. Submit a test booking with your real phone number
3. Check Supabase → **Table Editor** → `bookings` — your booking should appear
4. Check your phone — you should get the SMS within ~10 seconds

---

## VIEWING YOUR BOOKINGS

### Option A — Supabase Table Editor (simplest)
- Supabase → **Table Editor** → `bookings`
- You can sort by `created_at` to see newest first

### Option B — Supabase Dashboard (nicer)
- Supabase → **Table Editor** → click any row to see full details
- You can filter by `service`, `status`, etc.

### Option C — Build an admin page (future)
When you're ready, we can build a password-protected `/admin` page that shows all bookings in a clean table with status management.

---

## PRICING ESTIMATES (built in)

The price badge in Step 2 shows automatically based on selections:

| Service           | Trigger       | Price Range     |
|-------------------|---------------|-----------------|
| Car Detail        | Package select | $80–$220        |
| Trash Cleaning    | Bin count      | $25–$90+        |
| Pressure Washing  | Area select    | $80–$350+       |
| Window Cleaning   | Window count   | $60–$300+       |

To update prices, search for `showPrice(` in `index.html` and edit the range strings.

---

## FUTURE UPGRADES (when ready)

- [ ] Customer confirmation email (via Supabase + Resend.com — free tier)
- [ ] Admin dashboard to manage booking status
- [ ] Google Calendar integration (auto-create appointment)
- [ ] Stripe payment deposit to reduce no-shows
- [ ] Google Places autocomplete for address field
- [ ] Review/rating follow-up text 24hrs after service

---

## QUICK REFERENCE

| Thing              | Where to find it                                    |
|--------------------|-----------------------------------------------------|
| Supabase URL       | Supabase → Project Settings → API                  |
| Supabase anon key  | Supabase → Project Settings → API                  |
| Twilio SID         | twilio.com/console → Account Info                  |
| Twilio Auth Token  | twilio.com/console → Account Info (click reveal)   |
| Your bookings      | Supabase → Table Editor → bookings                 |
| Redeploy           | `git push origin main` (Vercel auto-deploys)        |

---

Questions? The whole stack is:
- **Frontend** → `index.html` (Vercel)
- **Database** → Supabase `bookings` table
- **SMS** → `supabase/functions/notify-booking/index.ts` → Twilio
