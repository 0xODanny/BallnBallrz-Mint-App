// src/pages/api/balln/tokenURI.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";

const RPC = process.env.AVAX_RPC!;
const provider = new ethers.providers.JsonRpcProvider(RPC);
const BALLRZ = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
const ABI = [
  "function tokenURI(uint256 tokenId) view returns (string)"
];

const nft = new ethers.Contract(BALLRZ, ABI, provider);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const tokenId = String(req.query.tokenId || "");
    if (!tokenId) return res.status(400).json({ error: "tokenId required" });
    const tokenUri: string = await nft.tokenURI(tokenId);
    res.json({ tokenUri });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "server error" });
  }
}