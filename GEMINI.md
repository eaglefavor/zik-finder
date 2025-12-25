# Zik Lodge Finder

## Project Overview
Zik Lodge Finder is a web-based platform designed to streamline the process of finding and managing off-campus accommodation. It connects tenants (primarily students) with landlords, offering a secure marketplace for listing, searching, and requesting properties.

## Tech Stack
- **Framework:** Next.js 16.1.0 (App Router)
- **Language:** TypeScript
- **UI Library:** React 19.2.3
- **Styling:** Tailwind CSS v4
- **Backend/Database:** Supabase (PostgreSQL, Auth)
- **Image Storage:** Cloudinary
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Validation:** Zod

## Key Features
- **User Authentication:** Supabase Auth for Tenants, Landlords, and Admins.
- **Lodge Management:** Create, update, delete listings with images (Cloudinary).
- **Search & Filter:** Find lodges by location, price, etc.
- **Requests & Favorites:** Tenants can express interest and save favorites.
- **Admin Dashboard:** Manage users and content.

## Project Structure
- `src/app/`: Next.js App Router pages and API routes.
- `src/components/`: Reusable UI components.
- `src/lib/`: Utility functions, Supabase client configuration, and type definitions.
- `conductor/`: Project documentation, product specs, and tech stack details.
- `public/`: Static assets.

## Development

### Core Commands
- **Start Development Server:** `npm run dev` (Runs on `0.0.0.0`)
- **Build for Production:** `npm run build`
- **Start Production Server:** `npm run start`
- **Lint Code:** `npm run lint`

### Conventions
- **Styling:** Use Tailwind CSS utility classes.
- **Icons:** Use `lucide-react` components.
- **Database:** Use the Supabase client (`src/lib/supabase.ts`) for data access.
- **Types:** Define shared types in `src/lib/types.ts`.
- **Validation:** Use Zod schemas for form and API validation.

## Documentation
Refer to the `conductor/` directory for detailed product guidelines (`product.md`), technical stack information (`tech-stack.md`), and specific workflow tracks.
- **Active Development Tracks:** Check `conductor/tracks/` for specific feature implementation plans (e.g., `auth_flow_20251224`).
