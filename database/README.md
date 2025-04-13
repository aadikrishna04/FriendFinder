# Database Fixes

This directory contains SQL scripts to fix database issues with the FriendFinder app.

## Known Issues Fixed

1. User signup only storing email (missing phone_number, resume, tags fields)
2. Trigger function not including all required fields

## How to Apply Fixes

You can apply these fixes by running the `apply_fixes.sh` script:

```bash
# Make sure the script is executable
chmod +x apply_fixes.sh

# Run the script
./apply_fixes.sh
```

### Prerequisites

- You need the PostgreSQL client (`psql`) installed
- You need to set the following environment variables:
  - `SUPABASE_URL`: Your Supabase database URL
  - `SUPABASE_ANON_KEY`: Your Supabase anon key

You can set these either in your `.env` file at the root of the project or export them directly:

```bash
export SUPABASE_URL=your_supabase_url
export SUPABASE_ANON_KEY=your_anon_key
```

## Manual Application

If you prefer to apply the fixes manually, you can run:

```bash
# Apply user trigger fixes
psql your_supabase_url -f ./sql/fix_user_trigger.sql

# Apply RLS policy fixes
psql your_supabase_url -f ./sql/supabase_rls_fix.sql
```

## Scripts

- `fix_user_trigger.sql`: Fixes the database trigger to properly include all fields from the user schema
- `supabase_rls_fix.sql`: Sets up proper Row Level Security (RLS) policies 