import type { NextApiRequest, NextApiResponse } from "next";
import { Pool } from "pg";
import { ethers } from "ethers";

// import the same math as the client to keep results consistent
import {
  BASE_DAILY_POINTS,
  SPEED_CAP_TOKENS,
} from "@/utils/ballnStaking";

const { POSTGRES_URL, AVAX_RPC, NEXT_PUBLIC_CONTRACT_ADDRESS } = process.env;
if (!POSTGRES_URL) throw new Error("POSTGRES_URL is not set");
if (!AVAX_RPC) throw new Error("AVAX_RPC is not set");
if (!NEXT_PUBLIC_CONTRACT_ADDRESS) throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is not set");

const pg = new Pool({ connectionString: POSTGRES_URL });
const provider = new ethers.providers.JsonRpcProvider(AVAX_RPC);

// contracts
const BALLN = "0x4Afc7838167b77530278483c3d8c1fFe698a912E";
const BALLRZ = NEXT_PUBLIC_CONTRACT_ADDRESS;

const erc20Abi = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];
const erc721Abi = ["function balanceOf(address) view returns (uint256)"];
const erc20 = new ethers.Contract(BALLN, erc20Abi, provider);
const erc721 = new ethers.Contract(BALLRZ, erc721Abi, provider);

function tokenSpeedFactor(baln: number) {
  return Math.min(1, baln / SPEED_CAP_TOKENS);
}
function boostFromNfts(nfts: number) {
  // +0.5% per NFT up to +25%
  const pct = Math.min(25, nfts * 0.5);
  return 1 + pct / 100;
}
function perDayPoints(baln: number, nfts: number) {
  return BASE_DAILY_POINTS * tokenSpeedFactor(baln) * boostFromNfts(nfts);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const wallet = String(req.query.wallet || "");
    if (!ethers.utils.isAddress(wallet)) return res.status(400).json({ error: "invalid wallet" });
    const w = wallet.toLowerCase();

    // ensure enrolled
    const rowQ = await pg.query(
      `SELECT last_points, last_update, last_baln, last_nfts
       FROM balln_staking_wallets WHERE wallet = $1`,
      [w]
    );
    if (!rowQ.rows.length) return res.status(404).json({ error: "not enrolled" });

    const row = rowQ.rows[0] as {
      last_points: string | number;
      last_update: Date;
      last_baln: string | number | null;
      last_nfts: number | null;
    };

    // read on-chain now
    const [rawBal, dec, rawNfts] = await Promise.all([
      erc20.balanceOf(wallet),
      erc20.decimals(),
      erc721.balanceOf(wallet),
    ]);
    const balnNow = Number(rawBal.toString()) / 10 ** Number(dec);
    const nftsNow = Number(rawNfts.toString());

    const lastBaln = Number(row.last_baln ?? 0);
    const lastNfts = Number(row.last_nfts ?? 0);
    let points = Number(row.last_points ?? 0);

    let reset = false;
    // if any required holding decreased, reset to 0
    if (balnNow < lastBaln - 1e-9 || nftsNow < lastNfts) {
      points = 0;
      reset = true;
    } else {
      const lastUpdateMs = new Date(row.last_update).getTime();
      const nowMs = Date.now();
      const elapsedSec = Math.max(0, (nowMs - lastUpdateMs) / 1000);
      if (elapsedSec > 0) {
        const perDay = perDayPoints(balnNow, nftsNow);
        const perSec = perDay / 86400;
        points += perSec * elapsedSec;
      }
    }

    // persist
    const upd = await pg.query(
      `UPDATE balln_staking_wallets
       SET last_points = $2,
           last_update = NOW(),
           last_baln = $3,
           last_nfts = $4
       WHERE wallet = $1
       RETURNING extract(epoch FROM last_update)*1000 AS last_ms`,
      [w, points, balnNow, nftsNow]
    );

    res.json({
      wallet: w,
      points,
      last_ms: Number(upd.rows[0].last_ms),
      per_day: perDayPoints(balnNow, nftsNow),
      reset,
      baln: balnNow,
      nfts: nftsNow,
    });
  } catch (e: any) {
    console.error("points error:", e);
    res.status(500).json({ error: e?.message || "server error" });
  }
}