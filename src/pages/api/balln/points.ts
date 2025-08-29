import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import { POSTGRES_URL } from '@/utils/addresses';

const pg = new Pool({ connectionString: POSTGRES_URL });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const wallet = String(req.query.wallet || '').toLowerCase();
    if (!wallet) return res.status(400).json({ error: 'wallet required' });

    const q = `
      SELECT last_points, extract(epoch FROM last_update)*1000 AS last_ms
      FROM balln_staking_wallets
      WHERE lower(wallet) = $1
    `;
    const { rows } = await pg.query(q, [wallet]);
    if (!rows.length) return res.status(404).json({ error: 'not enrolled' });

    res.json({ wallet, points: Number(rows[0].last_points), last_ms: Number(rows[0].last_ms) });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'server error' });
  }
}