// src/pages/api/balln/redeem.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { Pool } from "pg";
import { ethers } from "ethers";

const COST = 3333;

// --- Env guards (fail fast) ---
const { POSTGRES_URL, AVAX_RPC, PRIVATE_KEY, CONTRACT_ADDRESS, NEXT_PUBLIC_CONTRACT_ADDRESS } = process.env;
if (!POSTGRES_URL) throw new Error("POSTGRES_URL is not set");
if (!AVAX_RPC) throw new Error("AVAX_RPC is not set");
if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY is not set");
const BALLRZ = CONTRACT_ADDRESS || NEXT_PUBLIC_CONTRACT_ADDRESS;
if (!BALLRZ) throw new Error("CONTRACT_ADDRESS or NEXT_PUBLIC_CONTRACT_ADDRESS is not set");

// PG pool reused across invocations
const pg = new Pool({ connectionString: POSTGRES_URL });

// RPC & signer
const provider = new ethers.providers.JsonRpcProvider(AVAX_RPC);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Ballrz NFT contract
const ABI = [
  "function adminMint(address to) public", // if your fn returns uint256 that's fine, we still parse logs
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "function tokenURI(uint256 tokenId) view returns (string)", // optional helper
];
const nft = new ethers.Contract(BALLRZ, ABI, wallet);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    const raw = String(req.body.wallet || "");
    if (!ethers.utils.isAddress(raw)) return res.status(400).json({ error: "invalid wallet" });
    const walletAddr = ethers.utils.getAddress(raw);

    await pg.query("BEGIN");

    // Lock row for this wallet
    const { rows } = await pg.query(
      `SELECT last_points FROM balln_staking_wallets WHERE lower(wallet)=lower($1) FOR UPDATE`,
      [walletAddr]
    );
    if (!rows.length) {
      await pg.query("ROLLBACK");
      return res.status(404).json({ error: "not enrolled" });
    }

    const currentPoints = Number(rows[0].last_points);
    if (currentPoints < COST) {
      await pg.query("ROLLBACK");
      return res.status(400).json({ error: "insufficient points", points: currentPoints });
    }

    // Deduct points first (safer than minting then trying to deduct)
    await pg.query(
      `UPDATE balln_staking_wallets
       SET last_points = last_points - $2, last_update = NOW()
       WHERE lower(wallet) = lower($1)`,
      [walletAddr, COST]
    );

    // Do the mint
    const tx = await nft.adminMint(walletAddr);
    const receipt = await tx.wait(); // wait for confirmation

    // Parse tokenId from Transfer event
    let tokenIdStr: string | null = null;
    const iface = new ethers.utils.Interface(ABI);

    for (const log of receipt.logs ?? []) {
      if (log.address.toLowerCase() !== BALLRZ.toLowerCase()) continue;
      try {
        const parsed = iface.parseLog(log);
        if (parsed.name === "Transfer") {
          const from = parsed.args.from as string;
          const to = parsed.args.to as string;
          const tokenId = parsed.args.tokenId as ethers.BigNumber;
          if (from === ethers.constants.AddressZero && to.toLowerCase() === walletAddr.toLowerCase()) {
            tokenIdStr = tokenId.toString();
            break;
          }
        }
      } catch {
        // not our event, ignore
      }
    }

    // Log redemption
    await pg.query(
      `INSERT INTO balln_redemptions(wallet, cost_points, tx_hash) VALUES($1, $2, $3)`,
      [walletAddr, COST, receipt.transactionHash]
    );

    await pg.query("COMMIT");

    return res.json({ ok: true, txHash: receipt.transactionHash, tokenId: tokenIdStr });
  } catch (e: any) {
    // Any error -> rollback DB state
    await pg.query("ROLLBACK").catch(() => {});
    return res.status(500).json({ error: e?.message || "server error" });
  }
}