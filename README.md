# Enterprise Multi-Tenant HRMS

This is the central repository for the Enterprise Multi-Tenant HRMS.

## 📂 Project Directory Structure

```
d:/hr/
├── backend/            # Express.js + TypeScript REST API Server
│   ├── src/
│   │   ├── config/     # Database configuration (Supabase PostgreSQL client)
│   │   ├── middlewares/# Express custom middlewares (Keycloak JWT validation)
│   │   └── server.ts   # Entrypoint & routing
│   ├── .env.example    # Environment variables configurations template
│   ├── get_token.js    # Utility script to test Keycloak token retrieval
│   ├── package.json    # Backend project dependencies & scripts
│   └── tsconfig.json   # TypeScript configurations compiler settings
├── database/
│   └── schema.sql      # Database tables and references inside 'hrms' schema
└── README.md           # This file
```

---

## 🛠️ Step-by-Step Setup Guide

### 1. Database Migrations
1. Open the local Supabase dashboard: `http://127.0.0.1:54323/`
2. Open the **SQL Editor** tab.
3. Open the file [database/schema.sql](file:///d:/hr/database/schema.sql) from this repository, copy the SQL content, paste it into the Supabase editor, and click **Run**.

### 2. Backend Environment Variables
1. Go to the `backend/` directory.
2. Copy `.env.example` and create a file named `.env`.
3. Set your database connection parameters and Keycloak realm secrets:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres?schema=hrms"
   KEYCLOAK_AUTH_SERVER_URL="http://localhost:8080"
   KEYCLOAK_REALM="hrms"
   KEYCLOAK_CLIENT_ID="hrms-backend-api"
   ```

### 3. Install Dependencies & Start Backend
1. Open a terminal in the `backend/` folder:
   ```powershell
   cd d:\hr\backend
   npm install
   ```
2. Start the API server in development mode:
   ```powershell
   npm run dev
   ```
3. Test your Keycloak token flow using:
   ```powershell
   node get_token.js
   ```
