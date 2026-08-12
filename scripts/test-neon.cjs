/* eslint-disable @typescript-eslint/no-require-imports */
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
client.connect()
  .then(() => client.query('SELECT 1 AS ok'))
  .then((r) => { console.log('NEON OK:', JSON.stringify(r.rows[0])); return client.end(); })
  .catch((e) => { console.error('NEON FAIL:', e.message); process.exit(1); });
