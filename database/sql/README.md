# SQL Database Migrations

This directory contains SQL migration scripts for the FriendFinder app.

## How to Run Migrations

To run these migrations on your Supabase database:

1. Connect to your Supabase instance using the SQL Editor in the Supabase dashboard.
2. Copy and paste the contents of the migration file into the editor.
3. Run the SQL commands.

Alternatively, you can run them from the command line:

```bash
psql -h YOUR_SUPABASE_HOST -U postgres -d postgres -f database/sql/group_features.sql
```

Replace `YOUR_SUPABASE_HOST` with your actual Supabase host.

## Available Migrations

- `group_features.sql`: Adds privacy settings and member limits to groups.
- `group_features_alternate.sql`: Alternative version of the same migration using a simpler approach with PL/pgSQL. Try this if the main script fails.

## Troubleshooting

If you encounter errors with the main migration script, try the alternate version which uses a different approach to set group ownership. 