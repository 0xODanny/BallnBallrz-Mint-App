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

  const handleMint = async () => {
    if (!address) return alert("Connect your wallet first.");
    setLoading(true);

    try {
      const { ethereum } = window;
      const provider = new ethers.providers.Web3Provider(ethereum, "any");
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();
      const deployer = process.env.NEXT_PUBLIC_DEPLOYER_WALLET;

      const tx = await signer.sendTransaction({
        to: deployer,
        value: ethers.utils.parseEther((1.33 * quantity).toFixed(4)),
      });
      await tx.wait();

      const res = await fetch("/api/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, quantity, paymentMethod: "avax" }),
      });

      const data = await res.json();
      if (data.success) {
        window.location.href = `/success?tokenIds=${data.tokenIds.join(",")}`;
      } else {
        alert("Mint failed: " + data.error);
      }
    } catch (err) {
      console.error(err);
      alert("Transaction failed: " + err.message);
    }

    setLoading(false);
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
        <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginBottom: "1rem" }}>
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

          {/* 🔶 NEW: Go to Staking */}
          <a
            href="/ballrz-staking"
            style={{
              display: "inline-block",
              padding: "0.6rem 1.2rem",
              backgroundColor: "#f97316", // orange
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
              <option key={q} value={q}>{q}</option>
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
          Your wallet: {connectionStatus === "connected" ? address : "Not connected"}
        </p>
      </div>
    </main>
  );
}