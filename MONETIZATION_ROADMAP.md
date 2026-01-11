# ZikLodge Monetization Roadmap

## Phase 1: Launch & Traction (0 - 6 Months)
*Focus: Trust & Convenience*

- [x] **Landlord Verification Fee**
    - **Concept:** One-time fee for ID/Selfie verification processing.
    - **Value:** "Verified" badge increases student trust and CTR.
    - **Tech:** Payment gateway integration before setting `verification_docs.status = 'approved'`.

- [ ] **"Urgent" Student Requests (CANCELLED)**
    - **Concept:** Fee for students to mark requests as "Urgent".
    - **Reason:** Low demand expected; complicating the schema. Removed in Phase 1.

- [ ] **Lodge Photography Service**
    - **Concept:** Paid service for professional lodge photos.
    - **Value:** High-quality images (optimized via our `next/image` setup) sell faster.
    - **Tech:** Admin upload override; "Official Photos" badge.

## Phase 2: Growth (6 - 18 Months)
*Focus: Visibility & Lead Access*

- [ ] **Promoted Listings (Sponsored Slots)**
    - **Concept:** Paid pinning of lodges to the top of search results.
    - **Value:** Combats visibility loss as inventory grows.
    - **Tech:** Add `promoted_until` column; Update sort logic in `data-context.tsx`.

- [ ] **Lead Unlocking (The "Tinder" Model)**
    - **Concept:** Hide student phone numbers in Market requests unless landlord has credits/subscription.
    - **Value:** Direct access to high-intent leads.
    - **Tech:** RLS policies on `requests.student_phone` based on subscription status.

- [ ] **Hyper-Local Advertising**
    - **Concept:** Banner ads for local businesses (ISPs, Movers, Food).
    - **Value:** Highly targeted student demographic in Awka.
    - **Tech:** Inject Ad component into lodge feed loops.

## Phase 3: Maturity (18+ Months)
*Focus: Ecosystem & Recurring Revenue*

- [ ] **SaaS Tools for Landlords (Subscription)**
    - **Concept:** Rent reminders, digital receipts, tenant management.
    - **Value:** Digitalizes landlord operations beyond just acquisition.
    - **Tech:** New `tenants` table; Automated Edge Function reminders.

- [ ] **Commission on Payments (Escrow)**
    - **Concept:** Rent processed via App; held until move-in.
    - **Value:** Eliminates "pay and dash" scams; ultimate trust layer.
    - **Tech:** Paystack/Flutterwave Split Payments; Ledger system.

- [ ] **Data Monetization**
    - **Concept:** Sell market aggregate reports to developers.
    - **Value:** Insights on demand/pricing trends in specific areas (Ifite vs Okpuno).
    - **Tech:** Aggregation queries on `requests` and `lodge_views_log`.

## Phase 4: Granular Control (24+ Months)
*Focus: Inventory Volume & Fairness*

- [ ] **Pay-Per-Slot (Per-Room Listing Fee)**
    - **Concept:** Landlords pay for the specific number of units (vacancies) they want to advertise, rather than a flat listing fee.
    - **Value:** Fairness. A landlord with a 60-unit complex pays more than one with a 4-room house.
    - **Pricing (Est. 2026):**
        - Single Room: ₦300/unit/session
        - Self-Contained: ₦700/unit/session
        - Flat/Apartment: ₦1,500/unit/session
    - **Tech:**
        - Link `lodge_units` to a `payment_status`.
        - Rooms only go "Live" (visible in search) after `available_units * unit_price` is paid.
        - Integration with Paystack/Flutterwave for dynamic cart totals.
