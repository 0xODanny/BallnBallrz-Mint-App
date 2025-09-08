import type { NextApiRequest, NextApiResponse } from "next";
import { Pool } from "pg";
import { ethers } from "ethers";
import {
  BASE_DAILY_POINTS,
  SPEED_CAP_TOKENS,
} from "@/utils/ballnStaking"; // only for typing clarity; we don't need them here but fine if present

// env
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    const wallet = String(req.body.wallet || "");
    if (!ethers.utils.isAddress(wallet)) return res.status(400).json({ error: "invalid wallet" });
    const w = ethers.utils.getAddress(wallet);

    // seed on-chain snapshot so accrual can start immediately
    const [rawBal, dec, rawNfts] = await Promise.all([
      erc20.balanceOf(w),
      erc20.decimals(),
      erc721.balanceOf(w),
    ]);
    const baln = Number(rawBal.toString()) / 10 ** Number(dec);
    const nfts = Number(rawNfts.toString());

    await pg.query(
      `
      INSERT INTO balln_staking_wallets (wallet, last_points, last_update, last_baln, last_nfts)
      VALUES (lower($1), 0, NOW(), $2, $3)
      ON CONFLICT (wallet) DO UPDATE
      SET last_update = EXCLUDED.last_update,
          last_baln   = EXCLUDED.last_baln,
          last_nfts   = EXCLUDED.last_nfts
      `,
      [w.toLowerCase(), baln, nfts]
    );

    res.json({ ok: true, seeded: { baln, nfts } });
  } catch (e: any) {
    console.error("enroll error:", e);
    res.status(500).json({ error: e?.message || "server error" });
  }
}