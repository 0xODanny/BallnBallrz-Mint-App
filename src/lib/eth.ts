// src/lib/eth.ts (ethers v5)
import { ethers } from "ethers";
import ballrzAbi from "@/abi/ballrz.json"; // ensure adminMint & tokenURI are present

export const RPC = process.env.AVAX_RPC!;
export const BALLRZ = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
export const PRIVATE_KEY = process.env.PRIVATE_KEY!;

export const provider = new ethers.providers.JsonRpcProvider(RPC);
export const signer = new ethers.Wallet(PRIVATE_KEY, provider);
export const ballrz = new ethers.Contract(BALLRZ, ballrzAbi, signer);

// Small helper to read from chain without signer
export const readProvider = provider;
export const ballrzRead = new ethers.Contract(BALLRZ, ballrzAbi, readProvider);