// src/pages/api/balln/redeem.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { Pool } from "pg";
import { ethers } from "ethers";

const COST = 3333;

/* ───────────────────────── Env + runtime guards ───────────────────────── */
const {
  POSTGRES_URL,
  AVAX_RPC,
  PRIVATE_KEY,
  CONTRACT_ADDRESS,
  NEXT_PUBLIC_CONTRACT_ADDRESS,
} = process.env;

if (!POSTGRES_URL) throw new Error("POSTGRES_URL is not set");
if (!AVAX_RPC) throw new Error("AVAX_RPC is not set");
if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY is not set");

const BALLRZ_RAW = CONTRACT_ADDRESS ?? NEXT_PUBLIC_CONTRACT_ADDRESS;
if (!BALLRZ_RAW) throw new Error("CONTRACT_ADDRESS or NEXT_PUBLIC_CONTRACT_ADDRESS is not set");

/** Checksum the address and make it a definite `string`. */
const BALLRZ: string = ethers.utils.getAddress(BALLRZ_RAW);

/* ───────────────────────── Shared clients/contracts ───────────────────── */
const pg = new Pool({ connectionString: POSTGRES_URL });

const provider = new ethers.providers.JsonRpcProvider(AVAX_RPC);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

/** ABI: adminMint + Transfer (for tokenId parsing) + optional tokenURI */
const ABI = [
  "function adminMint(address to) public", // if it returns uint256, logs parsing still works
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "function tokenURI(uint256 tokenId) view returns (string)",
] as const;

const nft = new ethers.Contract(BALLRZ, ABI, wallet);

/* ───────────────────────────── Handler ──────────────────────────────── */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const raw = String(req.body.wallet ?? "");
  if (!ethers.utils.isAddress(raw)) return res.status(400).json({ error: "invalid wallet" });
  const walletAddr = ethers.utils.getAddress(raw);

  try {
    await pg.query("BEGIN");

    // Lock the wallet row
    const { rows } = await pg.query<{ last_points: string }>(
      `SELECT last_points FROM balln_staking_wallets
         WHERE lower(wallet)=lower($1)
         FOR UPDATE`,
      [walletAddr]
    );

    if (rows.length === 0) {
      await pg.query("ROLLBACK");
      return res.status(404).json({ error: "not enrolled" });
    }

    const currentPoints = Number(rows[0].last_points);
    if (currentPoints < COST) {
      await pg.query("ROLLBACK");
      return res.status(400).json({ error: "insufficient points", points: currentPoints });
    }

    // Deduct points first; DB stays consistent if mint fails (we add back on catch)
    await pg.query(
      `UPDATE balln_staking_wallets
         SET last_points = last_points - $2,
             last_update = NOW()
       WHERE lower(wallet)=lower($1)`,
      [walletAddr, COST]
    );

    // Mint NFT
    const tx = await nft.adminMint(walletAddr);
    const receipt = await tx.wait();

    // Extract tokenId from Transfer event (mint emits from 0x0 -> wallet)
    const iface = new ethers.utils.Interface(ABI);
    const ballrzLc = BALLRZ.toLowerCase();
    let tokenIdStr: string | null = null;

    for (const log of receipt.logs ?? []) {
      if ((log.address || "").toLowerCase() !== ballrzLc) continue;
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
        // not our event; ignore
      }
    }

    // Log redemption
    await pg.query(
      `INSERT INTO balln_redemptions(wallet, cost_points, tx_hash)
       VALUES ($1, $2, $3)`,
      [walletAddr, COST, receipt.transactionHash]
    );

    await pg.query("COMMIT");

    return res.status(200).json({
      ok: true,
      txHash: receipt.transactionHash,
      tokenId: tokenIdStr, // may be null if event parsing didn’t match
    });
  } catch (e: any) {
    // Put points back if we had already deducted them
    try {
      await pg.query(
        `UPDATE balln_staking_wallets
           SET last_points = last_points + $2,
               last_update = NOW()
         WHERE lower(wallet)=lower($1)`,
        [req.body?.wallet ?? "", COST]
      );
    } catch {
      // ignore compensation failure; DB may still be locked/rolled back below
    }

    await pg.query("ROLLBACK").catch(() => {});
    return res.status(500).json({ error: e?.message || "server error" });
  }
}