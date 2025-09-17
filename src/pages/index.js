import { useState, useEffect } from "react";
import {
  useAddress,
  useConnectionStatus,
  ConnectWallet,
} from "@thirdweb-dev/react";
import { ethers } from "ethers";

export default function Home() {
  const address = useAddress();
  const connectionStatus = useConnectionStatus();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sparkles, setSparkles] = useState([]);

  useEffect(() => {
    const generated = [...Array(65)].map(() => ({
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 10}s`,
    }));
    setSparkles(generated);
  }, []);

  function explain(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err?.reason) return err.reason;
  if (err?.message) return err.message;
  const data = err?.data || err?.error || err;
  if (typeof data === "object") {
    try {
      return JSON.stringify(
        { code: data.code ?? err.code, message: data.message ?? err.message, reason: data.reason },
        null,
        2
      );
    } catch {}
  }
  return String(err);
}

const handleMint = async () => {
  if (!address) return alert("Connect your wallet first.");
  setLoading(true);
  try {
    if (!window?.ethereum) throw new Error("No wallet found. Install MetaMask.");

    const provider = new ethers.providers.Web3Provider(window.ethereum, "any");

    // 1) ask permission
    await provider.send("eth_requestAccounts", []);

    // 2) ensure Avalanche C-Chain (43114) with add-chain fallback
    try {
      const net = await provider.getNetwork();
      if (Number(net.chainId) !== 43114) {
        await provider.send("wallet_switchEthereumChain", [{ chainId: "0xa86a" }]);
      }
    } catch (e) {
      if (e?.code === 4902) {
        await provider.send("wallet_addEthereumChain", [{
          chainId: "0xa86a",
          chainName: "Avalanche C-Chain",
          nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
          rpcUrls: [process.env.NEXT_PUBLIC_AVAX_RPC || "https://api.avax.network/ext/bc/C/rpc"],
          blockExplorerUrls: ["https://snowtrace.io/"],
        }]);
      } else {
        throw e;
      }
    }

    // 3) signer AFTER permission/network
    const signer = provider.getSigner();
    const userAddress = await signer.getAddress();

    // 4) send AVAX (no float math) + balance guard
const deployer = process.env.NEXT_PUBLIC_DEPLOYER_WALLET;
if (!deployer) throw new Error("Missing NEXT_PUBLIC_DEPLOYER_WALLET");

const priceWei  = ethers.utils.parseUnits("1.33", 18);
const totalWei  = priceWei.mul(ethers.BigNumber.from(String(quantity)));

const balWei    = await provider.getBalance(userAddress);
const bufferWei = ethers.utils.parseUnits("0.01", 18); // safer buffer (~0.01 AVAX)

if (balWei.lt(totalWei.add(bufferWei))) {
  const have  = Number(ethers.utils.formatUnits(balWei, 18)).toFixed(4);
  const need  = Number(ethers.utils.formatUnits(totalWei.add(bufferWei), 18)).toFixed(4);
  alert(
    `Not enough AVAX.\n\nYou have: ${have} AVAX\nNeed (incl. gas): ~${need} AVAX`
  );
  setLoading(false);
  return;
}

// Sanity: which address are we paying?
console.log("Paying to:", deployer);

// 1) Verify you have the expected balance
console.log("totalWei:", totalWei.toString());
console.log("balWei:", balWei.toString());

// 2) Verify the payee is an EOA (no code). If it's a contract, value transfer may revert.
const code = await provider.getCode(deployer);
if (code && code !== "0x") {
  alert("Payment address is a contract. Set NEXT_PUBLIC_DEPLOYER_WALLET to an EOA that can receive AVAX.");
  setLoading(false);
  return;
}

    const payTx = await signer.sendTransaction({ to: deployer, value: totalWei });
    await payTx.wait();

    // 5) call backend to adminMint
    const r = await fetch("/api/mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: userAddress, quantity, paymentMethod: "avax" }),
    });

    let data;
    try { data = await r.json(); }
    catch {
      const text = await r.text();
      throw new Error(`Server response not JSON: ${text.slice(0, 200)}`);
    }

    if (!data?.success) throw new Error(data?.error || "Server mint failed");
    window.location.href = `/success?tokenIds=${data.tokenIds.join(",")}`;
  } catch (err) {
    console.error("Mint error:", err);
    alert("Transaction failed: " + (err?.message || String(err)));
  } finally {
    setLoading(false);
  }
};

  return (
    <main
      style={{
        backgroundImage: "url('/ballrz-bg-2.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          backgroundColor: "#111",
          padding: "2rem",
          border: "4px solid #00bfff",
          borderRadius: "15px",
          maxWidth: "600px",
          width: "100%",
          color: "#fff",
          fontFamily: "Arial, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ marginBottom: "1rem" }}>
          <ConnectWallet />
        </div>

        {/* TOP NAV BUTTONS */}
<div
  style={{
    display: "flex",
    gap: "10px",
    justifyContent: "center",
    marginBottom: "1rem",
  }}
>
  <a
    href="/my_ballrz"
    style={{
      display: "inline-block",
      padding: "0.6rem 1.2rem",
      backgroundColor: "#ffde59",
      color: "#000",
      fontWeight: "bold",
      borderRadius: "8px",
      textDecoration: "none",
      fontSize: "1.05rem",
    }}
  >
    🏀 My Balln Ballrz
  </a>

  {/* ✅ Staking is live */}
  <a
    href="/ballrz-staking"
    style={{
      display: "inline-block",
      padding: "0.6rem 1.2rem",
      backgroundColor: "#f97316",
      color: "#000",
      fontWeight: "bold",
      borderRadius: "8px",
      textDecoration: "none",
      fontSize: "1.05rem",
      border: "2px solid #fb923c",
      boxShadow: "0 0 10px rgba(249,115,22,0.4)",
    }}
  >
    🔶 Staking
  </a>
</div>

        <h1 style={{ fontSize: "1.75rem", margin: "1.5rem 0" }}>
          🏀 Mint a Balln Ballrz NFT
        </h1>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            margin: "1.5rem 0",
            position: "relative",
          }}
        >
          <div
            style={{
              width: "300px",
              borderRadius: "20px",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <img
              src="/ballnballrz-preview.png"
              alt="Ballrz NFT"
              style={{ width: "100%", display: "block", borderRadius: "20px" }}
            />
            <div className="css-sparkles">
              {sparkles.map((s, i) => (
                <div
                  key={i}
                  className="twinkle"
                  style={{ top: s.top, left: s.left, animationDelay: s.delay }}
                />
              ))}
            </div>
          </div>
        </div>

        <p style={{ margin: "1rem 0" }}>
          Each NFT costs <strong>1.33 AVAX</strong>
        </p>

        <div style={{ marginBottom: "1rem" }}>
          <label>Quantity: </label>
          <select onChange={(e) => setQuantity(Number(e.target.value))}>
            {[1, 3, 5, 10].map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleMint}
          disabled={loading}
          style={{
            padding: "0.75rem 3rem",
            backgroundColor: "#00bfff",
            color: "#000",
            fontWeight: "bold",
            fontSize: "1.75rem",
            border: "none",
            borderRadius: "12px",
            cursor: "pointer",
          }}
        >
          {loading ? "Minting..." : "Mint Now"}
        </button>

        <div
          style={{
            marginTop: "1.5rem",
            padding: "1rem",
            backgroundColor: "#e6f7ff",
            border: "2px solid #00bfff",
            borderRadius: "10px",
            color: "#000",
            fontWeight: "bold",
            lineHeight: "1.6",
          }}
        >
          Minting in our official Telegram chat is even more fun!
          <br />
          🏀{" "}
          <a
            href="https://t.me/BALLN3"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#007acc", textDecoration: "underline" }}
          >
            Come and join the game!
          </a>{" "}
          🏀
        </div>

        <p style={{ marginTop: "1rem" }}>
          Your wallet:{" "}
          {connectionStatus === "connected" ? address : "Not connected"}
        </p>
      </div>
    </main>
  );
}