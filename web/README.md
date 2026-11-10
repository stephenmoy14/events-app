# web

The site: what's on in Chicago over the next 30 days, read from the `upcoming_events`
view in Supabase (already filtered to not-ended, not-cancelled, not-duplicate).

```bash
cd web
npm install
cp .env.example .env.local   # fill in SUPABASE_URL and SUPABASE_ANON_KEY
npm run dev                  # http://localhost:3000
```

Without the two variables it shows a small built-in sample so the layout can be worked on.

Filters live in the URL (`?when=weekend&cat=music&cat=comedy&free=1&hood=Pilsen&q=jazz`),
so every view can be bookmarked or shared, and the filter form works without JavaScript.

Deploy: Vercel → import the GitHub repo → Root Directory `web` → add the two variables.
