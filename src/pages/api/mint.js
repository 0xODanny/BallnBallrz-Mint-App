import { ethers } from "ethers";
import ballrzAbi from "../../../abi/ballrz.json";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { address, quantity } = req.body;

  // ✅ Validate inputs
  if (!ethers.utils.isAddress(address)) {
    return res.status(400).json({ success: false, error: "Invalid wallet address" });
  }
  if (!quantity || isNaN(quantity) || quantity <= 0) {
    return res.status(400).json({ success: false, error: "Invalid quantity" });
  }

  try {
    // ✅ Initialize provider and wallet
    const provider = new ethers.providers.JsonRpcProvider({
      url: process.env.AVAX_RPC,
      chainId: 43114,
      name: "avalanche",
    });

    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      ballrzAbi,
      wallet
    );

    // ✅ Call adminMint
    const tx = await contract.adminMint(address, quantity);
    const receipt = await tx.wait();

    // ✅ Extract minted token IDs
    const iface = new ethers.utils.Interface(ballrzAbi);
    const tokenIds = receipt.logs.reduce((acc, log) => {
      try {
        const parsed = iface.parseLog(log);
        if (
          parsed.name === "Transfer" &&
          parsed.args.to.toLowerCase() === address.toLowerCase()
        ) {
          acc.push(parsed.args.tokenId.toString());
        }
      } catch {
        // Skip non-matching logs
      }
      return acc;
    }, []);

    return res.status(200).json({ success: true, tokenIds });
  } catch (err) {
    console.error("🚨 Mint error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Unexpected mint failure",
    });
  }
}