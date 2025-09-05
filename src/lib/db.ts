// src/lib/db.ts
import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  // Neon needs SSL; POSTGRES_URL likely already has sslmode=require
});