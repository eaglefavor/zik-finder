# Restore Point: Pre-ZIPS 4.0
**Date:** Monday, January 12, 2026
**Commit Hash:** `6979b9b8dda9e5608f5fb02b95afb1669bed852c`

## 🛑 Emergency Reversion Instructions
If the implementation of ZIPS 4.0 (The "Agent Killer" model) breaks the application, follow these steps to restore the project to this exact stable state.

### 1. Revert Codebase
Run the following git command to discard all changes and move the HEAD back to this safe point:
```bash
git checkout 6979b9b8dda9e5608f5fb02b95afb1669bed852c
```
*Note: This will detach your HEAD. To create a new branch from this point:*
```bash
git checkout -b restore-pre-zips4
```

### 2. Revert Database Schema
If new tables (`landlord_wallets`, `unlocked_leads`, etc.) have been created, you must drop them to return to the clean schema.

**Execute this SQL to clean up ZIPS 4.0 artifacts (if they exist):**
```sql
-- Drop ZIPS 4.0 Tables
DROP TABLE IF EXISTS public.unlocked_leads;
DROP TABLE IF EXISTS public.credit_transactions;
DROP TABLE IF EXISTS public.landlord_wallets;

-- Remove ZIPS 4.0 Columns from Lodges
ALTER TABLE public.lodges 
DROP COLUMN IF EXISTS is_silently_flagged,
DROP COLUMN IF EXISTS last_price_edit_at,
DROP COLUMN IF EXISTS admin_note;

-- Drop ZIPS 4.0 Functions/Triggers (if created)
DROP FUNCTION IF EXISTS check_integrity();
DROP FUNCTION IF EXISTS unlock_lead(UUID);
```

### 3. Verify Current "Safe" State
At this restore point, the system has the following features active and stable:
- **Post Lodge:** Free, unverified initially.
- **Landlord Verification:** Paid (₦500), handled by `submit_landlord_verification` RPC.
- **Boost Listing:** Paid (₦1,000), handled by `promote_lodge` RPC.
- **Admin Stats:** Functional, using `007_admin_stats.sql`.
- **Payment Verification:** Server-side via `verify-payment` Edge Function.

**Active Migration Files (Do NOT delete these):**
- `001_security_revamp.sql` ... to ... `007_admin_stats.sql`
- `006_monetization_security.sql` (Contains the critical Payment & Verification RPCs)

### 4. Edge Function Restoration
If you modified `verify-payment/index.ts` for ZIPS 4.0, you must redeploy the version that **only** handles `verification_fee` and `promoted_listing` (removing `credit_purchase`).
