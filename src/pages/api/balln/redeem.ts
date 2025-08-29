// src/pages/api/balln/redeem.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { Pool } from "pg";
import { ethers } from "ethers";

const COST = 3333;
const pg = new Pool({ connectionString: process.env.POSTGRES_URL });

// Ballrz admin mint setup
const RPC = process.env.AVAX_RPC!;
const provider = new ethers.providers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

// Ballrz NFT contract (uses your Ballrz address)
const BALLRZ = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
const ABI = [
  // adjust to your contract function
  "function adminMint(address to) public", 
  // or "function mintTo(address to, uint256 qty) public" etc.
];
const nft = new ethers.Contract(BALLRZ, ABI, wallet);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    const walletAddr = String(req.body.wallet || "").toLowerCase();
    if (!ethers.utils.isAddress(walletAddr)) return res.status(400).json({ error: "invalid wallet" });

    await pg.query("BEGIN");

    // read current points (FOR UPDATE to lock the row)
    const { rows } = await pg.query(
      `SELECT last_points FROM balln_staking_wallets WHERE lower(wallet)=lower($1) FOR UPDATE`,
      [walletAddr]
    );
    if (!rows.length) {
      await pg.query("ROLLBACK");
      return res.status(404).json({ error: "not enrolled" });
    }

    const pts = Number(rows[0].last_points);
    if (pts < COST) {
      await pg.query("ROLLBACK");
      return res.status(400).json({ error: "insufficient points", points: pts });
    }

    // deduct points
    await pg.query(
      `UPDATE balln_staking_wallets
       SET last_points = last_points - $2, last_update = NOW()
       WHERE lower(wallet)=lower($1)`,
      [walletAddr, COST]
    );

    // mint on-chain
    const tx = await nft.adminMint(walletAddr); // adjust if your function differs
    const receipt = await tx.wait();

    // log redemption
    await pg.query(
      `INSERT INTO balln_redemptions(wallet, cost_points, tx_hash) VALUES($1, $2, $3)`,
      [walletAddr, COST, receipt.transactionHash]
    );

    await pg.query("COMMIT");
    return res.json({ ok: true, txHash: receipt.transactionHash });
  } catch (e: any) {
    await pg.query("ROLLBACK").catch(()=>{});
    return res.status(500).json({ error: e?.message || "server error" });
  }
}