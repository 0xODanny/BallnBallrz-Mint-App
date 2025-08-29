import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pg = new Pool({ connectionString: process.env.POSTGRES_URL });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const wallet = String(req.body.wallet || '').toLowerCase();
    if (!wallet) return res.status(400).json({ error: 'wallet required' });

    await pg.query(
      `INSERT INTO balln_staking_wallets(wallet) VALUES($1)
       ON CONFLICT(wallet) DO NOTHING`,
      [wallet]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'server error' });
  }
}