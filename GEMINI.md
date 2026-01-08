# ZikLodge Project Context

## Project Overview
**ZikLodge** is a real estate platform designed to connect students in Awka (specifically near Nnamdi Azikiwe University) with landlords. It facilitates finding and managing rental accommodations ("lodges"). The application supports distinct user roles with tailored features for searching, listing, and managing properties.

## Tech Stack
*   **Framework:** [Next.js](https://nextjs.org/) (App Router)
*   **Language:** TypeScript
*   **Database & Auth:** [Supabase](https://supabase.com/)
*   **Image Storage:** [Cloudinary](https://cloudinary.com/)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **Animations:** [Framer Motion](https://www.framer.com/motion/)
*   **Icons:** [Lucide React](https://lucide.dev/)
*   **State Management:** React Context (`useAppContext`, `useData`)

## Key Features

### 1. User Roles
*   **Students:**
    *   Browse and search for lodges.
    *   Filter by location (e.g., Ifite, Amansea, Okpuno).
    *   View lodge details, including units/rooms and pricing.
    *   Contact landlords via Phone or WhatsApp (tracks interactions).
    *   Save favorites.
*   **Landlords:**
    *   Dashboard to view property analytics (views, growth).
    *   Post and edit lodge listings.
    *   Manage units (inventory) within a lodge.
    *   Toggle lodge visibility (Available/Hidden).
    *   Receive notifications when students initiate contact.
*   **Admins:**
    *   Access to an Admin Dashboard for system oversight.

### 2. Core Functionality
*   **Infinite Scroll:** Implemented for browsing lodges to optimize performance.
*   **Real-time Notifications:** Supabase is used to notify landlords of student interest via a secure `send_lodge_inquiry` RPC.
*   **Privacy-Focused RLS:** User profiles are protected; student data is private unless they have active requests, while landlord profiles remain public.
*   **Image Handling:** Cloudinary integration for uploading and serving property images.

## Project Structure
*   `src/app`: Next.js App Router pages and API routes.
    *   `src/app/admin`: Admin dashboard routes.
    *   `src/app/lodge`: Lodge details view.
    *   `src/app/post` & `src/app/edit-lodge`: Property management forms.
    *   `src/app/search`: Search functionality.
*   `src/components`: Reusable UI components.
*   `src/lib`: Core application logic.
    *   `supabase.ts`, `cloudinary.ts`: Service clients.
    *   `context.tsx`, `data-context.tsx`: Global state.
    *   `types.ts`: TypeScript interfaces for Data Models (Lodge, Profile, Notification, etc.).
*   **Root Directory:** Contains numerous `.sql` files. These are critical for database schema management, RLS policies, and triggers in Supabase.

## Database Management
Database changes are versioned through SQL scripts located in the root directory.
*   **Security Revamp:** `001_security_revamp.sql` secures `SECURITY DEFINER` functions and restricts notification/profile access.
*   **Schema Updates:** Files like `add_landmark_column.sql`, `upgrade_to_property_units.sql`.
*   **Logic:** `create_notifications_table.sql`, `fix_rls.sql`.
*   **Initialization:** `supabase_init.sql`.

## Building and Running

### Prerequisites
*   Node.js (LTS recommended)
*   Supabase Project
*   Cloudinary Account

### Installation
```bash
npm install
# or
yarn install
```

### Development Server
```bash
npm run dev
```
The application will be available at `http://localhost:3000`.

### Production Build
```bash
npm run build
npm start
```

## Development Conventions
*   **Styling:** Use Tailwind CSS utility classes. Global styles are in `src/app/globals.css`.
*   **Type Safety:** Strictly adhere to TypeScript interfaces defined in `src/lib/types.ts`.
*   **Components:** Functional components with React Hooks.
*   **Linting:** ESLint is configured (`npm run lint`).