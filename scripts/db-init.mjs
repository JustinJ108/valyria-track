// Creates the Neon tables: `DATABASE_URL=... npm run db:init`
import { initDb } from "../lib/db.js";
await initDb();
console.log("Tables ready.");
