# ZikLodge Fixes & Optimization Plan

## 1. Image Optimization (Critical for Performance/LCP)
Replace all instances of standard HTML `<img>` tags with Next.js optimized `<Image />` component.

- [x] `src/app/admin/page.tsx`
- [x] `src/app/edit-lodge/[id]/page.tsx`
- [x] `src/app/favorites/page.tsx`
- [x] `src/app/market/page.tsx`
- [x] `src/app/post/page.tsx`
- [x] `src/app/profile/page.tsx`
- [x] `src/app/profile/settings/page.tsx`
- [x] `src/app/search/page.tsx`

## 2. Performance & Data Architecture
Refactor the data fetching strategy to improve Time to Interactive (TTI).

- [x] **Split `DataProvider` Initialization:**
    - Refactor `src/lib/data-context.tsx`.
    - Remove the massive `Promise.all` in the initial `useEffect`.
    - Isolate critical data (User Session) from non-critical data (View Growth, Requests).
- [x] **Lazy Loading:**
    - Implement lazy fetching for `requests` (only needed for Market).
    - Implement lazy fetching for `viewGrowth` (only needed for Landlord Dashboard).
- [ ] **Server Components (Long-term):**
    - Refactor `src/app/page.tsx` to fetch the initial batch of lodges on the server and pass as props, reducing client-side waterfalls. (Deferred)

## 3. Backend Logic & Reliability
Move critical business logic from fragile client-side code to robust Database Triggers.

- [x] **Price Drop Notifications:**
    - Remove client-side logic in `updateLodge`.
    - Create a Postgres Trigger on `lodges` update to detect price decreases and notify favorited users.
    - File: `zik-finder/trigger_price_drop.sql`
- [x] **Low Availability Alerts:**
    - Remove client-side logic in `updateUnitAvailability`.
    - Create a Postgres Trigger on `lodge_units` update to notify users when stock drops (<= 2).
    - File: `zik-finder/trigger_low_availability.sql`
- [x] **Request Matching:**
    - Remove client-side logic in `addRequest`.
    - Create a Postgres Trigger on `requests` insert to find matching lodges and notify landlords.
    - File: `zik-finder/trigger_request_matching.sql`

## 4. Database Integrity
- [x] **Audit `delete_own_user`:**
    - Verify `delete_account_function.sql`.
    - Ensure tables `notifications`, `favorites`, `verification_docs` have correct `ON DELETE CASCADE` setup to prevent errors during account deletion.
    - Created robust function in `zik-finder/fix_delete_account_final.sql`.