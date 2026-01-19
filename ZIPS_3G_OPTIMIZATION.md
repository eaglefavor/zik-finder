# ZikLodge 3G Optimization Plan (Network-Resilient Architecture)

**Objective:** Engineer ZikLodge to be bulletproof on the unstable 3G/Slow 4G networks of Ifite and Okpuno (UNIZIK).
**Status:** In Progress

---

## 🏗️ Phase 1: Transport Layer (HTTP/3 & 0-RTT)
*Goal: Ensure packets survive packet loss.*

- [x] **Enable HTTP/3 (QUIC):**
    - **Implementation:** Enabled via Vercel/Cloudflare settings (managed by platform).
    - **Status:** Done (Vercel supports this by default).

- [ ] **0-RTT Connection:**
    - **Implementation:** Configure TLS 1.3 0-RTT on CDN.
    - **Status:** Pending (Platform dependent).

---

## 💾 Phase 2: Data Architecture (Caching & Compression)
*Goal: Send less data, load instantly from cache.*

- [ ] **TanStack Query (React Query) + Persistence:**
    - **Concept:** "Stale-While-Revalidate" engine.
    - **Implementation:**
        - Install `@tanstack/react-query` and persister.
        - Wrap `_app` or `layout` with QueryClientProvider.
        - Migrate `useData` context fetching to `useQuery`.
        - Configure `persistClient` with `localStorage` or `IndexedDB`.
    - **Status:** Dependencies installed (`@tanstack/react-query`, etc.). Implementation Pending.

- [x] **Compression (Brotli/AVIF):**
    - **Implementation:** `next.config.ts` updated with `compress: true` and `formats: ['image/avif', 'image/webp']`.
    - **Status:** Done.

---

## 📡 Phase 3: Offline-First Mutation
*Goal: "Fire and Forget" actions.*

- [ ] **Background Sync (Service Worker):**
    - **Concept:** Queue failed uploads/posts and retry when online.
    - **Implementation:**
        - Register Service Worker (`next-pwa` or custom).
        - Use IndexedDB for "Outbox".
        - Implement Sync Manager for `POST /api/lodges`.
    - **Status:** Pending.

- [ ] **Resumable Uploads (TUS Protocol):**
    - **Concept:** Chunked uploads that resume after network failure.
    - **Implementation:**
        - Replace `compressorjs` + simple fetch with `uppy` or Supabase TUS client.
        - Configure Supabase Storage for Resumable uploads.
    - **Status:** Pending.

---

## 🖼️ Phase 4: Asset Optimization
*Goal: Visuals load instantly.*

- [x] **Image Optimization:**
    - **Implementation:** `sizes` prop added to `next/image`. `quality` prop adjusted for mobile.
    - **Status:** Done.

- [ ] **BlurHash Placeholders:**
    - **Concept:** Colorful blur string while image loads.
    - **Implementation:**
        - Generate BlurHash on upload.
        - Store in DB `lodges.image_blurhash`.
        - Use `placeholder="blur"` in `next/image`.
    - **Status:** Pending.

---

## 🧠 Phase 5: Adaptive Intelligence
*Goal: Degrade gracefully on slow networks.*

- [x] **Network Detection Hook:**
    - **Implementation:** `src/hooks/useNetworkQuality.ts` created.
    - **Status:** Done.

- [ ] **Adaptive Rendering:**
    - **Concept:** Disable heavy features (video/3D) on `slow-2g` or `3g`.
    - **Implementation:** Use `useNetworkQuality` in `LodgeDetail` components.
    - **Status:** Pending Integration.

---

## 🚀 Phase 6: Advanced (Streaming & BFF)
*Goal: Eliminate "White Screen".*

- [ ] **React Server Components (RSC) Streaming:**
    - **Concept:** Stream HTML parts.
    - **Implementation:** Ensure `Suspense` boundaries are granular. (Partially done in `page.tsx`).
    - **Status:** Ongoing.

- [x] **Backend for Frontend (BFF/DTOs):**
    - **Concept:** Select only needed fields.
    - **Implementation:** `get_lodges_feed` RPC updated to select specific columns.
    - **Status:** Done.
