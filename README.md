# The Workshop — Personal Dashboard

A personal hobby dashboard for coffee, garden, reading, movies & TV, and writing.
Built with Next.js, Supabase, and Vercel.

---

## What's in here

| Section | What it does |
|---|---|
| Coffee | Log bags with tasting notes, browse roaster feeds |
| Garden | Bed planner, planting calendar (Zone 6a), harvest log |
| Reading | Timeline synced from Goodreads RSS |
| Movies & TV | Film diary + TV tracker, posters from TMDb |
| Writing | Journal entries, drafts, and notes with built-in editor |

---

## Accounts you need (all free)

| Service | What for | URL |
|---|---|---|
| Supabase | Database | supabase.com |
| TMDb | Movie/TV posters | themoviedb.org/settings/api |
| Vercel | Hosting | vercel.com |

---

## Part 1 — Run it locally

### 1. Install Node.js
Download the LTS version from nodejs.org and install it.
Check it worked: open Terminal and type `node --version`

### 2. Unzip the project
Unzip workshop.zip anywhere on your computer.

### 3. Open Terminal in the project folder
Mac: open Terminal, type `cd ` then drag the workshop folder in and press Enter.
Windows: open the workshop folder, right-click → "Open in Terminal".

### 4. Install dependencies
```
npm install
```
Takes 1-2 minutes the first time.

### 5. Set up Supabase
1. Create a free account at supabase.com
2. New project → give it a name, pick a region, set a database password
3. Go to Settings → API, copy the Project URL and anon public key
4. Go to SQL Editor and run this to create all the tables:

```sql
create table bags (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  roaster text, name text, origin text, process text, varietal text,
  roast_date date, purchase_date date, weight_g int, price numeric,
  score numeric, aroma text, flavor text, aftertaste text,
  acidity text, body text, balance text, overall text, notes text,
  brew_method text, bag_url text, is_green boolean default false
);

create table roasters (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null, shop_url text, api_url text,
  platform text default 'shopify',
  type text default 'roasted',
  woo_category_id text, collection_handle text
);

create table watches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  title text not null, type text not null,
  year int, director text, runtime int,
  seasons int, season_from int, season_to int,
  tv_status text, rating int default 0,
  date_watched date, genre text, poster text,
  tmdb_id int, watchlist boolean default false, notes text
);

create table harvests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  plant text not null, bed int not null,
  amount text not null, unit text not null,
  date date not null, notes text
);

create table writing (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  title text not null, body text,
  type text not null,
  is_public boolean default false,
  word_count int default 0
);

insert into roasters (name, shop_url, api_url, platform, type, collection_handle) values
  ('Prodigal Coffee', 'https://www.prodigalcoffee.com', 'https://www.prodigalcoffee.com', 'shopify', 'green', 'green-coffee'),
  ('Subtext Coffee', 'https://subtextcoffee.com', 'https://subtextcoffee.com', 'shopify', 'roasted', 'coffee'),
  ('Rogue Wave Coffee', 'https://roguewavecoffee.com', 'https://roguewavecoffee.com', 'shopify', 'roasted', 'coffee');
```

### 6. Get a TMDb API key
1. Create a free account at themoviedb.org
2. Go to Settings → API → Request an API key → Developer
3. Copy the API Key (v3 auth)

### 7. Create your .env.local file
Copy .env.local.example to a new file called .env.local and fill it in:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
TMDB_API_KEY=your-tmdb-key-here
GOODREADS_USER_ID=38583676

DASHBOARD_PASSWORD=pick-a-strong-password
SESSION_SECRET=any-long-random-string-abc123xyz789
```

DASHBOARD_PASSWORD is what you type to log in.
SESSION_SECRET can be any random string — just mash the keyboard.

### 8. Run it
```
npm run dev
```
Open http://localhost:3000 in your browser.
You'll see the password screen — type the password you set above.

---

## Part 2 — Host it online (Vercel)

### 1. Push to GitHub
1. Create a free account at github.com
2. Download GitHub Desktop from desktop.github.com
3. Open GitHub Desktop → File → Add Local Repository → point to workshop folder
4. Click "Publish repository" — make it Private

### 2. Deploy on Vercel
1. Go to vercel.com, sign in with GitHub
2. New Project → Import your workshop repo
3. Before clicking Deploy, open "Environment Variables" and add all 6 variables from your .env.local
4. Click Deploy — takes about 2 minutes
5. Vercel gives you a URL like your-project.vercel.app

---

## How password protection works

Every page is protected by middleware.ts. Visiting any URL checks for a session
cookie. No cookie = redirect to /login. Correct password = cookie set for 30 days,
so you stay logged in on that device.

Writing entries marked Public are flagged in the database but not yet served at
a public URL — that's a future feature if you want a simple public writing page.

---

## Environment variables

| Variable | Where |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase → Settings → API |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase → Settings → API |
| TMDB_API_KEY | themoviedb.org → Settings → API |
| GOODREADS_USER_ID | Your Goodreads profile URL number |
| DASHBOARD_PASSWORD | You choose |
| SESSION_SECRET | Any random string |

---

## Project structure

```
workshop/
├── app/
│   ├── page.tsx              Home dashboard
│   ├── layout.tsx            Shared layout with sidebar
│   ├── login/page.tsx        Password screen
│   ├── coffee/               Coffee section
│   ├── garden/page.tsx       Garden section
│   ├── books/page.tsx        Reading (Goodreads)
│   ├── watching/page.tsx     Movies & TV
│   └── writing/page.tsx      Writing editor
│
├── app/api/
│   ├── auth/route.ts         Login endpoint
│   ├── bags/route.ts         Coffee bag log
│   ├── coffees/route.ts      Roaster product feed
│   ├── books/route.ts        Goodreads RSS parser
│   ├── tmdb/route.ts         TMDb search
│   ├── movies/route.ts       Watches database
│   ├── garden/route.ts       Harvest log
│   └── writing/route.ts      Writing entries
│
├── components/Sidebar.tsx    Navigation
├── lib/supabase.ts           Supabase client
├── middleware.ts             Password protection
└── .env.local.example        Copy → .env.local
```

---

## Regalia calendar notifications

Two emails get sent automatically:

1. **Schedule changed** — whenever Regalia updates their subscription page, you get an email with the full new schedule and any tasting notes scraped from individual product pages (shown honestly as absent if not found)
2. **Shipping reminder** — the day before each new coffee window starts, you get a heads-up with the coffee name, origin, and tasting notes

### Additional Supabase table

Run this in the Supabase SQL editor in addition to the tables above:

```sql
create table regalia_schedule (
  id int primary key,
  entries jsonb not null default '[]',
  updated_at timestamptz default now()
);
-- Seed an empty row so upsert works
insert into regalia_schedule (id, entries) values (1, '[]');
```

### Additional setup

1. Create a free account at **resend.com**
2. Add and verify your sending domain (or use `onboarding@resend.dev` just for testing)
3. Copy your API key
4. Add the new variables to `.env.local` (and Vercel environment variables when deploying):
   - `RESEND_API_KEY`
   - `NOTIFICATION_EMAIL` — your email address
   - `EMAIL_FROM` — e.g. `The Workshop <you@yourdomain.com>`
   - `CRON_SECRET` — any random string

### Testing it manually

Once deployed, trigger the cron manually in your browser:

```
https://your-project.vercel.app/api/cron/regalia?secret=YOUR_CRON_SECRET
```

It returns a JSON log showing what it found, whether the schedule changed, and whether emails were sent. Safe to run anytime.

### Schedule

The cron runs daily at **9am UTC** (5am EST / 4am CST). Configured in `vercel.json`.
