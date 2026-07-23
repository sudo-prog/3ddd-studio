# 3DDD.STUDIO

A PWA for applying decal images to a 3D garment.

## Run locally

**Prerequisites:** Node.js 18+

```
npm install
npm run dev
```

This is a plain static Vite + React app — no API keys, no server, no
environment variables required.

## Deploy to Vercel

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. In Vercel, "Add New Project" → import the repo.
3. Vercel auto-detects the Vite framework from `vercel.json` /
   `package.json` — leave the defaults:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Deploy. That's it — there's nothing else to configure.

Or from the CLI:
```
npm i -g vercel
vercel
```

See `AUDIT_AND_FIXES.md` for a full history of bugs found and fixed in this
project, and what each part of the app does.
