# ZIPS 4.0 Implementation Master Plan (The "Agent Killer")

**Status:** Draft / Ready for Implementation
**Objective:** Transition ZikLodge from a listing directory to a lead-generation marketplace powered by "Z-Credits".

---

## 🏗️ Phase 0: Foundation & Schema (Database Layer)
*Goal: Establish the data structures for Wallets, Credits, and Integrity.*

### 0.1 Config & Constants
- [ ] **Create Config File:** `src/lib/config/zips.ts`
    - Define exchange rates (`1 Credit = ₦100`).
    - Define Bundle packages (Starter, Agent Killer, Tycoon).
    - Define Lead Tiers (Standard, High-Value, Premium) based on student budget.
    - Define Z-Score thresholds (Shadowban: 30, Ban: 0).

### 0.2 Wallet Schema
- [ ] **Create Migration:** `009_zips_wallet_schema.sql`
    - **Table:** `landlord_wallets`
        - `landlord_id` (UUID, PK, FK -> profiles)
        - `balance` (INT, Default 0) - Stored in Credits
        - `z_score` (INT, Default 50)
        - `is_verified` (BOOLEAN, Default False) - Moving verification status here or syncing with `profiles`.
    - **Table:** `credit_transactions`
        - `id`, `landlord_id`, `amount` (+/-), `type` (purchase, unlock, bonus, penalty), `reference_id` (nullable, for linking to request/chat), `description`, `created_at`.
    - **RLS Policies:**
        - Landlords can read their own wallet.
        - Landlords can read their own transactions.
        - Only Service Role (Edge Functions/RPCs) can update balances.

### 0.3 Unlock Tracking Schema
- [ ] **Update Migration:** `009_zips_wallet_schema.sql` (continued)
    - **Table:** `unlocked_leads`
        - `landlord_id` (UUID)
        - `request_id` (UUID) - For Student Requests in Market.
        - `lodge_id` (UUID) - For Inbound Chat requests.
        - `student_id` (UUID) - The student being unlocked.
        - `unlocked_at` (TIMESTAMP)
        - `cost_paid` (INT)
        - **Constraint:** Compound Primary Key `(landlord_id, request_id, lodge_id, student_id)` to prevent double charging.

### 0.4 Integrity Schema
- [ ] **Update Migration:** `009_zips_wallet_schema.sql` (continued)
    - **Alter Table:** `lodges`
        - Add `is_silently_flagged` (BOOLEAN, Default FALSE).
        - Add `last_price_edit_at` (TIMESTAMP).
        - Add `admin_note` (TEXT).

---

## 💰 Phase 1: The Revenue Engine (Wallet & Payments)
*Goal: Allow landlords to buy Z-Credits via Paystack.*

### 1.1 Server-Side Logic (Edge Functions)
- [ ] **Update Function:** `verify-payment/index.ts`
    - Handle new `type: 'credit_purchase'`.
    - Logic:
        1. Verify Paystack transaction.
        2. Calculate Credits: `Amount (₦) / 100`.
        3. Apply Bundle Bonuses (e.g., if Amount >= 10000, add 10 credits).
        4. **Atomic Transaction:**
            - Insert into `credit_transactions` (`type: 'purchase'`).
            - Update `landlord_wallets` (`balance = balance + amount`).
            - Increase Z-Score (`+5 points`).

### 1.2 Database RPCs
- [ ] **Create RPC:** `get_wallet_balance(p_user_id)`
    - Returns `{ balance, z_score, is_verified }`.
- [ ] **Create RPC:** `top_up_wallet(p_user_id, p_amount, p_bonus)` (Internal use or secured).

### 1.3 Frontend: Landlord Wallet UI
- [ ] **New Page:** `src/app/wallet/page.tsx` (or inside `/profile`).
    - Display current Balance (Large, engaging UI).
    - "Top Up" Button -> Opens Modal.
    - Transaction History List (`credit_transactions`).
- [ ] **Component:** `CreditBundleSelector.tsx`
    - Cards for "Starter", "Agent Killer", "Tycoon".
    - Calls `PaymentModal` with `purpose="credit_purchase"`.

---

## 🔒 Phase 2: The "Masking" Protocol (Leakage Prevention)
*Goal: Ensure landlords cannot bypass the credit system.*

### 2.1 Data Sanitization (The Firewall)
- [ ] **Create Migration:** `010_zips_sanitization.sql`
    - **Trigger:** `trig_sanitize_content` on `lodges` and `profiles`.
    - **Function:** `regex_strip_phone_numbers()`
        - Regex: `/(0|\+234)[789][01]\d{8}/g` -> Replace with `[HIDDEN]`.
        - Apply to: Title, Description, Profile Name, Profile Bio.
    - **Trigger:** `trig_sanitize_images` (Optional/Later) -> Flag images with text? (For now, use manual review/reporting).

### 2.2 Frontend Masking
- [ ] **Update:** `src/app/lodge/[id]/page.tsx`
    - **Logic:** Check if current user (Student) is "Unlocked" by this Landlord?
    - **Wait, Model Check:** The model is "Landlord pays to unlock Student".
    - **Revised Flow:**
        1. Student views Lodge. Phone number is HIDDEN by default.
        2. Student clicks "Request Chat".
        3. **System Check:** Has this Landlord already unlocked this Student?
            - **Yes:** Show Chat/Phone immediately.
            - **No:** Send Notification to Landlord ("New Lead: Chinedu wants to chat. Unlock for 10 Credits?").
            - Student sees: "Request sent! Landlord will contact you."

---

## 🔓 Phase 3: The Unlock Flows (Revenue Logic)
*Goal: Implement the "Pay-to-Reveal" mechanics.*

### 3.1 Stream A: Reverse Market (Student Requests)
- [ ] **Update:** `src/app/market/page.tsx`
    - **UI:** Hide Student Phone Number & Full Name for Landlords.
    - **Action:** "Unlock Contact" button on Request Card.
    - **Pricing Badge:** Show cost based on Budget (Standard/High/Premium).
- [ ] **Logic:** `handleUnlockRequest(requestId)`
    - Call RPC `unlock_lead(requestId)`.
- [ ] **RPC:** `unlock_lead(p_request_id)`
    - Check Wallet Balance.
    - If sufficient:
        - Deduct Credits.
        - Log Transaction (`type: 'unlock_lead'`).
        - Insert into `unlocked_leads`.
        - Increment Z-Score (`+2`).
        - Return Student Contact Info.
    - If insufficient: Throw error "Insufficient Credits".

### 3.2 Stream B: Inbound Leads (Masked Listing)
- [ ] **Backend:** Notification Logic via Edge Function/Trigger.
    - When Student clicks "Request Chat":
    - Insert into `notifications` for Landlord.
    - Payload includes `action_link: /leads/inbound/${lead_id}`.
- [ ] **Frontend:** `src/app/leads/page.tsx` (Landlord Dashboard)
    - Tab: "Inbound Leads".
    - List of students who clicked "Request Chat".
    - "Unlock" button next to each.

---

## 🛡️ Phase 4: Trust & Safety (Z-Score System)
*Goal: Self-policing reputation engine.*

### 4.1 Scoring Logic (Triggers)
- [ ] **Create Migration:** `011_zips_integrity.sql`
    - **Trigger:** On `credit_transactions` insert -> Update `z_score`.
    - **Trigger:** On `reviews` insert -> Update `z_score` based on rating.
    - **Trigger:** On `reports` insert -> Deduct `z_score`.

### 4.2 The Kill Switch
- [ ] **Update:** `src/app/api/reviews/route.ts` (or wherever reviews are handled).
    - Check if `lodge.is_silently_flagged` is TRUE.
    - If Rating <= 2 stars:
        - Update Lodge: `status = 'suspended'`.
        - Deduct massive Z-Score (`-20`).
        - Notify Admin.

### 4.3 Silent Flagging (Price Drops)
- [ ] **Trigger:** `trig_detect_price_dump` on `lodges`.
    - If `NEW.price < OLD.price * 0.75`:
        - Set `is_silently_flagged = TRUE`.
        - Do NOT notify landlord.

---

## 🚀 Phase 5: Migration & Launch
*Goal: Transition existing users without angering them.*

### 5.1 Data Migration Script
- [ ] **Script:** `scripts/migrate_to_zips.ts`
    - Create wallets for all existing `profiles` (role='landlord').
    - **Grant Free Credits:** Give 50 Credits (₦5,000 value) to all existing landlords as a "Legacy Bonus".
    - Initialize Z-Score to 50.

### 5.2 Sanitization Run
- [ ] **Script:** Run regex cleaner on all existing lodge descriptions and titles to hide phone numbers.

### 5.3 User Onboarding
- [ ] **UI:** "Welcome to ZikLodge Pro" Modal on first login.
    - Explain Z-Credits.
    - Highlight the "Free 50 Credits".

---

## 📂 File Structure for Implementation
- `src/lib/config/zips.ts` (Constants)
- `src/lib/zips-context.tsx` (Wallet State Management)
- `supabase/migrations/` (SQL files 009-011)
- `src/components/wallet/` (Wallet UI components)
- `src/components/leads/` (Lead Management UI)
