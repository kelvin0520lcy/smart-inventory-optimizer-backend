# Supabase Deployment Guide

This document provides instructions for deploying the application with Supabase as the database backend.

## Prerequisites

- Node.js 16 or higher
- Access to the Supabase project
- Local PostgreSQL database with development data

## Setup

1. **Environment Configuration**

   The application uses `.env` for development and `.env.production` for production. Ensure both files are properly configured:

   - Development: Local PostgreSQL connection
   - Production: Supabase connection

2. **Database Migration**

   Before deploying, migrate your schema and data to Supabase:

   ```bash
   # Migrate schema first
   node server/migrate-schema-to-supabase.js
   
   # Then migrate data
   node server/migrate-data-to-supabase.js
   
   # Verify migration
   node server/check-supabase-data.js
   ```

3. **Testing Connections**

   Test both development and production database connections:

   ```bash
   node server/test-server-connection.js
   ```

   This script will verify connectivity to both the local PostgreSQL and Supabase.

## Deployment Steps

1. **Build the Application**

   ```bash
   # Build the client
   cd client
   npm run build
   
   # Build the server
   cd ../server
   npm run build
   ```

2. **Deploy to Production**

   For Vercel deployment:

   ```bash
   # Deploy using Vercel CLI
   vercel --prod
   ```

   Make sure the Vercel configuration includes all required environment variables, especially:
   - `NODE_ENV=production`
   - `DATABASE_URL` (Supabase connection string)
   - `USE_SSL=true`

3. **Verify Deployment**

   After deployment, verify the application is connected to Supabase:

   ```bash
   # Test production endpoint
   curl https://your-production-url.com/api/status
   ```

## Troubleshooting

- **Connection Issues:**
  - Verify SSL is properly configured
  - Check that environment variables are correctly set
  - Run `test-supabase-connection.js` to test direct connectivity

- **Schema Issues:**
  - If tables are missing, run the schema migration again
  - Check for any foreign key constraint violations

- **Data Issues:**
  - If data is missing, run the data migration with the `--force` flag
  - Verify sequences are properly set after migration

## Monitoring

- Check Supabase logs for any database errors
- Monitor the application logs for connection issues
- Set up monitoring for database performance

## Security Notes

- Database credentials in environment files should be kept secure
- Consider using environment variable encryption for sensitive values
- Review Supabase Row-Level Security (RLS) policies for additional security 