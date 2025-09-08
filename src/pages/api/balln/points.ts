// src/pages/api/balln/points.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { Pool } from "pg";
import { ethers } from "ethers";
import { dailyPoints } from "@/utils/ballnStaking";

// Env (read directly; do not import POSTGRES_URL from app code)
const { POSTGRES_URL, AVAX_RPC, NEXT_PUBLIC_CONTRACT_ADDRESS } = process.env;
if (!POSTGRES_URL) throw new Error("POSTGRES_URL missing");
if (!AVAX_RPC) throw new Error("AVAX_RPC missing");
if (!NEXT_PUBLIC_CONTRACT_ADDRESS) throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS missing");

const pg = new Pool({ connectionString: POSTGRES_URL });

// Contracts
const BALLN = "0x4Afc7838167b77530278483c3d8c1fFe698a912E"; // your ERC20
const BALLRZ = NEXT_PUBLIC_CONTRACT_ADDRESS;                 // your ERC721

const erc20Abi = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];
const erc721Abi = ["function balanceOf(address) view returns (uint256)"];

const provider = new ethers.providers.JsonRpcProvider(AVAX_RPC);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const wallet = String(req.query.wallet || req.body?.wallet || "").toLowerCase();
    if (!wallet || !ethers.utils.isAddress(wallet)) {
      return res.status(400).json({ error: "wallet required" });
    }

    // 1) Get current snapshot
    const { rows } = await pg.query(
      `SELECT wallet, last_points, last_update, last_baln, last_nfts
         FROM balln_staking_wallets
        WHERE lower(wallet)=lower($1)`,
      [wallet]
    );
    if (!rows.length) return res.status(404).json({ error: "not enrolled" });

    const row = rows[0];
    const lastPoints = Number(row.last_points || 0);
    const lastUpdate = new Date(row.last_update);
    const lastBal = Number(row.last_baln || 0);
    const lastNfts = Number(row.last_nfts || 0);

    // 2) Current on-chain balances
    const erc20 = new ethers.Contract(BALLN, erc20Abi, provider);
    const erc721 = new ethers.Contract(BALLRZ, erc721Abi, provider);
    const [rawBal, decimals, rawNfts] = await Promise.all([
      erc20.balanceOf(wallet),
      erc20.decimals(),
      erc721.balanceOf(wallet),
    ]);
    const balNow = Number(rawBal.toString()) / 10 ** Number(decimals);
    const nftsNow = Number(rawNfts.toString());

    // 3) Accrue points since last_update using the *previous* rate
    const seconds = Math.max(0, (Date.now() - lastUpdate.getTime()) / 1000);
    const perDayThen = dailyPoints(lastBal, lastNfts);
    const earned = (perDayThen / 86400) * seconds;

    // Reset if balance/NFTs dropped
    const dropped = balNow < lastBal || nftsNow < lastNfts;
    const newPoints = dropped ? 0 : lastPoints + earned;

    // 4) Snapshot and log occasionally
    await pg.query(
      `UPDATE balln_staking_wallets
          SET last_points=$2,
              last_update=NOW(),
              last_baln=$3,
              last_nfts=$4
        WHERE lower(wallet)=lower($1)`,
      [wallet, newPoints, balNow, nftsNow]
    );

    if (seconds >= 600 || dropped) {
      await pg.query(
        `INSERT INTO balln_points_log(wallet, points) VALUES($1, $2)`,
        [wallet, newPoints]
      );
    }

    // 5) Return updated status (perDay based on current balances)
    const perDayNow = dailyPoints(balNow, nftsNow);
    return res.json({
      wallet,
      points: newPoints,
      perDay: perDayNow,
      bal: balNow,
      nfts: nftsNow,
      reset: dropped,
      lastAppliedSeconds: Math.round(seconds),
    });
  } catch (e: any) {
    console.error("points error:", e);
    return res.status(500).json({ error: e?.message || "server error" });
  }
}