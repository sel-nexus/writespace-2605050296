# WriteSpace

A browser-local plain-text blogging demonstration, built with React 18, React Router 6, Vite 5 and Tailwind 3. All accounts, passwords, posts and sessions stay in this browser origin's localStorage. Credentials are plaintext; never enter a real password or sensitive content. Browser guards are not production authorization. Default demo administrator: `admin` / `admin`.

## Run
From `frontend`, run `npm ci --no-bin-links`, then `node node_modules/vite/bin/vite.js`. Copy `.env.example` to `.env` for public development configuration. Create an account through the landing page; users may edit/delete their own posts, and administrators may oversee all posts and eligible accounts. Data is not shared across devices/origins and has no backup.

## Verify
- Unit: `node node_modules/vitest/vitest.mjs run` from frontend — 443 tests passed in Developer verification.
- Production: `node node_modules/vite/bin/vite.js build` — passed.
- Browser: `node node_modules/@playwright/test/cli.js test` — blocked in this sandbox: runner hung without output on three attempts. Human approved proceeding with this warning. Browser screenshots/preflight and full journey results are NOT verified.
- Test critic: round 4 PASS, score 1.00, zero high-severity failures (structural review, not browser execution).

## Container delivery
`docker build -t writespace ./frontend` then `docker run --rm -p 8080:80 writespace`. nginx serves static assets and SPA deep routes; missing /assets resources return 404. AWS infrastructure is downstream DevOps scope. Root is the static health path. No backend, API, database, secrets or migration exists. The rewrite-only vercel.json is compatibility configuration; Vercel would require setting the frontend project root separately.

## Known limits
Whole-array writes can lose concurrent-tab updates; corrupt reads display empty without repairing bytes, and strict mutations refuse corrupt storage. Registration spans two non-atomic writes. Failed persistence retains input rather than claiming success. Account deletion touches only accounts. The duplicate dashboard user labels intentionally show identical totals, including default admin once. npm reported 20 vulnerabilities (5 moderate, 12 high, 3 critical); review before deployment. Docker image build and nginx config passed; a deep route returned200 HTML and a missing asset404. AWS deployment and the extended performance soak remain unverified.
