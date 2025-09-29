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
        alignItems: "flex-start", // push content down so ticker is visible
        paddingTop: "50px", // space for ticker
      }}
    >
      {/* 🔥 Top Ticker Banner */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          backgroundColor: "#f97316",
          color: "#fff",
          fontWeight: "bold",
          fontSize: "1rem",
          overflow: "hidden",
          whiteSpace: "nowrap",
          zIndex: 1000,
        }}
      >
        <div
          style={{
            display: "inline-block",
            paddingLeft: "100%",
            animation: "ticker 15s linear infinite",
          }}
        >
          The Balln Ballrz Collection has officially minted out. All 333 NFTs are
          now in circulation. Collect them for NBA tickets!
        </div>
        <style>{`
          @keyframes ticker {
            0% { transform: translateX(0%); }
            100% { transform: translateX(-100%); }
          }
        `}</style>
      </div>

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
          🏀 MINTED OUT! 🏀
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
          Original mint price: <strong>1.33 AVAX</strong>
        </p>

        {/* 🔒 Disabled Quantity Select */}
        <div style={{ marginBottom: "1rem", opacity: 0.5, pointerEvents: "none" }}>
          <label>Quantity: </label>
          <select disabled>
            {[1, 3, 5, 10].map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>

        {/* 🔒 Inactive Mint Button */}
        <button
          disabled
          style={{
            padding: "0.75rem 3rem",
            backgroundColor: "gray",
            color: "#000",
            fontWeight: "bold",
            fontSize: "1.75rem",
            border: "none",
            borderRadius: "12px",
            cursor: "not-allowed",
            opacity: 0.7,
          }}
        >
          Mint Closed
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