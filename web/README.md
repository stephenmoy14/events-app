# web (phase 6)

Placeholder. When the pipeline is filling the database, generate the app here:

```bash
npx create-next-app@latest web --ts --eslint --app --src-dir
```

It reads only the `upcoming_events` view (already filtered to not-ended, not-cancelled,
not-duplicate, next 30 days). Show times in America/Chicago and always link back to the source.
