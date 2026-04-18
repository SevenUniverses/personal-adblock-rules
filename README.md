## Adblocker rules (GitHub auto-publish)

This repo builds a **Chrome MV3 `declarativeNetRequest` dynamic rules** JSON from public filter lists, then publishes it to **GitHub Pages** on a schedule.

### What you get
- A public URL like `https://<your-user>.github.io/<repo>/rules.json`
- Your extension can set `REMOTE_RULESET_URL` to that URL and auto-update rules periodically.

### How it works
- GitHub Actions runs `npm run build:rules`
- It downloads filter lists (EasyList/EasyPrivacy, etc.)
- Converts them to MV3 DNR rules via `@eyeo/abp2dnr`
- Writes `docs/rules.json`
- Deploys `docs/` to GitHub Pages

### One-time setup
1. Create a new GitHub repo (any name, e.g. `personal-adblock-rules`)
2. Upload/push this folder’s contents
3. In GitHub: **Settings → Pages**
   - Source: **GitHub Actions**
4. After the first workflow run, your rules URL will be:
   - `https://<your-user>.github.io/<repo>/rules.json`

### Update cadence
- Scheduled daily (editable in `.github/workflows/publish.yml`)

### Local run (optional)
Requires Node.js 18+.

```bash
npm install
npm run build:rules
```

