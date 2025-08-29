// scripts/track_balln.ts  (ethers v5)
require('dotenv').config();
import { Pool } from 'pg';
import { ethers } from 'ethers';
import { accruePoints } from '../src/utils/ballnStaking';

// ---- env
const RPC = process.env.AVAX_RPC!;
const DB  = process.env.POSTGRES_URL!;
const BALLN = process.env.BALLN_TOKEN_ADDRESS || '0x4Afc7838167b77530278483c3d8c1fFe698a912E';
const BALLRZ = process.env.BALLRZ_CONTRACT_ADDRESS || '0x6b2b14002614292f99f9e09b94b59af396eac27d';

// ---- ethers v5 provider & contracts
const provider = new ethers.providers.JsonRpcProvider(RPC);
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)','function decimals() view returns (uint8)'];
const ERC721_ABI = ['function balanceOf(address owner) view returns (uint256)'];
const balln  = new ethers.Contract(BALLN,  ERC20_ABI, provider);
const ballrz = new ethers.Contract(BALLRZ, ERC721_ABI, provider);

// ---- db
const pg = new Pool({ connectionString: DB });

async function wallets(): Promise<string[]> {
  const { rows } = await pg.query(`SELECT wallet FROM balln_staking_wallets`);
  return rows.map(r => r.wallet as string);
}
async function upsert(wallet: string) {
  await pg.query(
    `INSERT INTO balln_staking_wallets(wallet) VALUES($1) ON CONFLICT(wallet) DO NOTHING`,
    [wallet]
  );
}
async function state(wallet: string) {
  const q = `SELECT last_points, extract(epoch FROM last_update)*1000 AS last_ms
             FROM balln_staking_wallets WHERE wallet=$1`;
  const { rows } = await pg.query(q, [wallet]);
  if (!rows.length) return { points: 0, lastMs: Date.now() };
  return { points: Number(rows[0].last_points), lastMs: Number(rows[0].last_ms) };
}
async function setState(wallet: string, points: number) {
  await pg.query(
    `UPDATE balln_staking_wallets SET last_points=$2, last_update=NOW() WHERE wallet=$1`,
    [wallet, points]
  );
  await pg.query(`INSERT INTO balln_points_log(wallet, points) VALUES($1, $2)`, [wallet, points]);
}

// ---- onchain helpers (v5 BigNumber -> number)
async function erc20Balance(addr: string) {
  const raw = await balln.balanceOf(addr);   // BigNumber
  const dec = await balln.decimals();        // number
  return Number(raw.toString()) / 10 ** dec;
}
async function erc721Count(addr: string) {
  const c = await ballrz.balanceOf(addr);    // BigNumber
  return Number(c.toString());
}

async function runOnce() {
  console.log('ethers:', require('ethers/package.json').version);
  console.log('RPC:', RPC);
  console.log('DB :', DB.slice(0, 60) + '…');

  const list = await wallets();
  for (const w of list) {
    try {
      await upsert(w);
      const [{ points, lastMs }, [bal, nfts]] = await Promise.all([
        state(w),
        Promise.all([erc20Balance(w), erc721Count(w)])
      ]);
      const now = Date.now();
      const newPoints = accruePoints(points, lastMs, now, bal, nfts);
      console.log('Processing', w, { bal, nfts, prev: points, next: Number(newPoints).toFixed(4) });
      await setState(w, newPoints);
    } catch (e: any) {
      console.error('Sync error for', w, e?.message || e);
    }
  }
}

runOnce()
  .then(() => { console.log('✅ track_balln finished'); return pg.end(); })
  .catch(async e => { console.error(e); await pg.end(); process.exit(1); });