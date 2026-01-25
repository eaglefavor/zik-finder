# Playwright Android Troubleshooting Checkpoint

## Current Status
- **Environment:** Android (Termux), aarch64.
- **Playwright Patch:** 
    - `node_modules/playwright-core/lib/server/registry/index.js` patched to support `android` platform.
    - `node_modules/playwright-core/lib/server/utils/hostPlatform.js` patched to map `android` to `linux-arm64`.
- **Browser:** System Chromium (`/usr/bin/chromium-browser`) symlinked to `~/.cache/ms-playwright/chromium-1200/chrome-linux/chrome`.
- **Config:** `playwright.config.ts` updated with `executablePath` and `--no-sandbox`.

## The Blocking Error
The test starts and launches Chromium, but fails with:
`Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/?login=true`

## Diagnosis
The Next.js development server (`npm run dev`) is failing to bind or stay active in the background. `curl http://localhost:3000` returns connection refused.

## Instructions for Next Session
1. **Start the Server:** Try starting Next.js in a separate terminal or ensure it's binding to `127.0.0.1` instead of `0.0.0.0` if necessary.
2. **Verify Reachability:** Run `curl -I http://localhost:3000` until it returns a `200 OK`.
3. **Run Test:** Execute `export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 && npx playwright test tests/repro_delete_bug.spec.ts`.

## Files Created
- `tests/repro_delete_bug.spec.ts`: The reproduction script.
- `fix_cascade_delete.sql`: DB fix for deletion persistence.
- `fix_frontend_logic_and_bugs.sql`: RPCs for secure contact fetching.
- `fix_notification_and_rpc.sql`: RPC for secure student notifications.
