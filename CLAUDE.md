# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CreditTalk Admin is a Next.js 15 admin dashboard for a Korean fraud prevention and reporting platform. It manages content (notices, arrest news, reviews), users, community posts, analytics, and push notifications.

## Commands

```bash
pnpm dev          # Start dev server with Turbopack (port 3000)
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint
```

Note: No test framework is configured.

## Tech Stack

- **Framework**: Next.js 15 (App Router) with React 19 and TypeScript
- **Database/Auth**: Supabase (PostgreSQL + Auth + Storage)
- **Styling**: Tailwind CSS v4
- **Forms**: React Hook Form
- **Package Manager**: pnpm 10.20.0

## Architecture

### Supabase Client Patterns

Three Supabase clients are used for different contexts:

| Client | Location | Usage |
|--------|----------|-------|
| `createClient()` | `src/lib/supabase/client.ts` | Browser-side (client components) |
| `createClient(cookieStore)` | `src/lib/supabase/server.ts` | Server components (pass `await cookies()`) |
| `supabaseAdmin` | `src/lib/supabase/admin.ts` | API routes only (service role key) |

### Authentication & Authorization

- Middleware (`src/middleware.ts`) protects all `/admin/*` routes
- Admin status verified via RPC: `supabase.rpc('is_current_user_admin')`
- Route redirects: `/` → `/admin` (if admin) or `/login` (if not)

### API Routes

All admin APIs are under `src/app/api/admin/`. Each route:
1. Verifies session and admin status
2. Uses `supabaseAdmin` for database operations
3. Returns JSON responses

### File Uploads

File uploads use presigned URLs:
1. Client calls `/api/admin/generate-upload-url` with bucket name and file path
2. Client uploads directly to Supabase Storage using the signed URL
3. Public URL is stored in the database

Storage buckets: `notice-images`, `arrest-news-images`, `review-images`, `incident-photos`, `new-crime-cases-images`, `posts-images`, `partners-images`

### Project Structure

```
src/
├── app/
│   ├── admin/           # Protected admin pages (dashboard, content CRUD)
│   ├── api/admin/       # 40+ API routes organized by resource
│   └── login/           # Login page
├── components/          # Form components (NoticeForm, PostForm, etc.)
├── lib/
│   ├── supabase/        # Three client configurations
│   └── analysisOptions.ts  # Fraud analysis decision tree
└── middleware.ts        # Route protection
```

### Key Patterns

- **Forms**: Use `react-hook-form` with `register()` and `handleSubmit()`
- **Data fetching in client components**: Direct Supabase queries in `useEffect`
- **Image optimization**: Use `next/image` with Supabase storage URLs
- **Mobile responsive**: Tables convert to card layout via CSS media queries

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Admin operations (secret)
- `FIREBASE_PROJECT_ID` - Firebase project (for push notifications)
- `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` - Firebase service account (secret)

## Database

- Schema managed via Supabase migrations in `supabase/migrations/`
- Edge functions in `supabase/functions/` (e.g., `process-scheduled-push`)
- Admin role check relies on `is_current_user_admin()` RPC function