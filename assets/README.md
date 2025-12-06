# Supertonic Assets (not tracked)

Models and voice presets are downloaded on demand. To fetch them locally:

```bash
npm run fetch:assets
```

This clones the official repo into `assets/` and strips its `.git` metadata so it stays out of this repo. If you need to refresh, delete `assets/` and run the command again.
