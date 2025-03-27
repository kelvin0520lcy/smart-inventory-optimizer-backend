# Database Migration to Supabase

This document outlines the steps taken to migrate the application database from local PostgreSQL to Supabase.

## Migration Scripts

- `migrate-schema-to-supabase.js`: Creates the necessary tables in Supabase
- `migrate-data-to-supabase.js`: Transfers data from local PostgreSQL to Supabase
- `check-supabase-data.js`: Verifies data in Supabase after migration
- `test-supabase-connection.js`: Tests the connection to Supabase

## Configuration Updates

- Updated `.env.production` with Supabase connection details
- Modified `db.ts` to handle SSL connections in production
- Updated `vercel.json` with Supabase environment variables

## Deployment Process

1. **Schema Migration:**
   ```
   node server/migrate-schema-to-supabase.js
   ```
   This script creates all necessary tables in Supabase based on the existing schema.

2. **Data Migration:**
   ```
   node server/migrate-data-to-supabase.js
   ```
   This script transfers all data from the local PostgreSQL database to Supabase.

3. **Verify Migration:**
   ```
   node server/check-supabase-data.js
   ```
   This script checks the data in Supabase to ensure it was migrated correctly.

## Connection Details

The application now uses:
- Local PostgreSQL for development
- Supabase for production

The environment detection is based on the `NODE_ENV` variable. When set to "production", the app will connect to Supabase with SSL enabled.

## Troubleshooting

If you encounter connection issues with Supabase:
1. Run `test-supabase-connection.js` to verify connectivity
2. Check that SSL is properly configured
3. Ensure environment variables are correctly set in both `.env.production` and `vercel.json` 