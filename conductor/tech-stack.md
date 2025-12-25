# Tech Stack: ZikLodge

## 1. Core Technologies
*   **Language:** TypeScript - For type-safe development and improved developer experience.
*   **Framework:** Next.js (v16.1.0) - Using the App Router for modern, server-side rendered and static web applications.
*   **UI Library:** React (v19.2.3) - For building modular and interactive user interfaces.

## 2. Backend & Data
*   **BaaS:** Supabase - Providing PostgreSQL database, Authentication, and Storage (buckets).
*   **Database:** PostgreSQL (via Supabase) - Relational database for storing user, lodge, and request data.
*   **ORM/Querying:** Supabase-js client for direct database interactions and RPC calls.

## 3. Media & File Management
*   **Cloud Storage:** Cloudinary - For optimized image storage, transformations, and delivery.
*   **Image Processing:** Compressorjs - For client-side image compression before upload.

## 4. Styling & Animation
*   **Styling:** Tailwind CSS (v4) - Utility-first CSS framework for rapid UI development.
*   **Animations:** Framer Motion - For smooth, high-performance UI animations.
*   **Icons:** Lucide React - For a consistent and modern icon set.

## 5. Utilities & Quality
*   **Validation:** Zod - For schema-based validation of form data and API responses.
*   **Linting:** ESLint - For maintaining code quality and adhering to Next.js standards.
