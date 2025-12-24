# Specification: User Authentication Flow

## 1. Overview
Implement a comprehensive authentication system using Supabase Auth to allow users (Tenants and Landlords) to securely sign up, sign in, and manage their sessions.

## 2. User Stories
- As a new user, I want to create an account using my email and password.
- As an existing user, I want to sign in to my account.
- As a user, I want to be able to reset my password if I forget it.
- As a logged-in user, I want to be able to sign out.
- As a user, I want to be redirected to the appropriate page after signing in (e.g., Market for tenants, Profile for landlords).

## 3. Functional Requirements
- Sign-up form with email, password, and user type selection (Tenant/Landlord).
- Sign-in form with email and password.
- Forgot password flow (request reset email).
- Password reset form.
- Persistent sessions using Supabase.
- Protected routes (only accessible to authenticated users).
- Integration with the existing Supabase client.

## 4. Technical Details
- **Backend:** Supabase Auth.
- **Frontend:** Next.js App Router, React forms.
- **Validation:** Zod for form schemas.
- **Styling:** Tailwind CSS.

## 5. Security Requirements
- Secure password handling (managed by Supabase).
- CSRF protection (managed by Next.js/Supabase).
- Rate limiting on auth attempts (managed by Supabase).
