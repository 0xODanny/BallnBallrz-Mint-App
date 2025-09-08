// src/pages/api/balln/enroll.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { Pool } from "pg";
import { ethers } from "ethers";

const { POSTGRES_URL, AVAX_RPC, NEXT_PUBLIC_CONTRACT_ADDRESS } = process.env;
if (!POSTGRES_URL) throw new Error("POSTGRES_URL missing");
if (!AVAX_RPC) throw new Error("AVAX_RPC missing");
if (!NEXT_PUBLIC_CONTRACT_ADDRESS) throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS missing");

const BALLN = "0x4Afc7838167b77530278483c3d8c1fFe698a912E";
const BALLRZ = NEXT_PUBLIC_CONTRACT_ADDRESS;

const pg = new Pool({ connectionString: POSTGRES_URL });
const provider = new ethers.providers.JsonRpcProvider(AVAX_RPC);
const erc20Abi = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];
const erc721Abi = ["function balanceOf(address) view returns (uint256)"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    const wallet = String(req.body.wallet || "").toLowerCase();
    if (!wallet || !ethers.utils.isAddress(wallet)) return res.status(400).json({ error: "wallet required" });

    // snapshot balances at registration
    const erc20 = new ethers.Contract(BALLN, erc20Abi, provider);
    const erc721 = new ethers.Contract(BALLRZ, erc721Abi, provider);
    const [rawBal, decimals, rawNfts] = await Promise.all([
      erc20.balanceOf(wallet),
      erc20.decimals(),
      erc721.balanceOf(wallet),
    ]);
    const balNow = Number(rawBal.toString()) / 10 ** Number(decimals);
    const nftsNow = Number(rawNfts.toString());

    await pg.query(
      `INSERT INTO balln_staking_wallets (wallet, last_points, last_update, last_baln, last_nfts)
       VALUES ($1, 0, NOW(), $2, $3)
       ON CONFLICT (wallet) DO UPDATE
         SET last_update = EXCLUDED.last_update,
             last_baln = EXCLUDED.last_baln,
             last_nfts = EXCLUDED.last_nfts`,
      [wallet, balNow, nftsNow]
    );

    res.json({ ok: true, balNow, nftsNow });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "server error" });
  }
}