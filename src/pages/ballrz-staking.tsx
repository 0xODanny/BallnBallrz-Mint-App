// src/pages/ballrz-staking.tsx
import { useEffect, useMemo, useState } from "react";
import { ConnectWallet, useAddress, useConnectionStatus } from "@thirdweb-dev/react";
import { ethers } from "ethers";
import {
  BASE_DAILY_POINTS,
  REDEEM_POINTS,
  dailyPoints,
  SPEED_CAP_TOKENS,
  boostFromNfts,
  tokenSpeedFactor,
} from "@/utils/ballnStaking";

const RPC = process.env.NEXT_PUBLIC_AVAX_RPC!;
const BALLN = "0x4Afc7838167b77530278483c3d8c1fFe698a912E";
const BALLRZ = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;

export default function BallrzStaking() {
  const address = useAddress();
  const status = useConnectionStatus();

  const [enrolled, setEnrolled] = useState(false);
  const [checkingEnroll, setCheckingEnroll] = useState(false);

  const [bal, setBal] = useState(0);
  const [nfts, setNfts] = useState(0);
  const [points, setPoints] = useState(0);
  const [redeeming, setRedeeming] = useState(false);

  // ───────────────── enrollment state ─────────────────
  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!address) {
        setEnrolled(false);
        return;
      }
      setCheckingEnroll(true);
      try {
        const r = await fetch(`/api/balln/points?wallet=${address}`);
        if (!ignore) setEnrolled(r.ok);
        if (r.ok) {
          const j = await r.json().catch(() => ({}));
          if (typeof j.points === "number") setPoints(Number(j.points));
        } else if (r.status === 404) {
          if (!ignore) setPoints(0);
        }
      } catch {
        /* noop */
      } finally {
        if (!ignore) setCheckingEnroll(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [address]);

  // ───────────────── poll points when enrolled ─────────────────
  useEffect(() => {
    if (!address || !enrolled) return;
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/balln/points?wallet=${address}`);
        if (!r.ok) return;
        const j = await r.json();
        if (!stop) setPoints(Number(j.points || 0));
      } catch {}
    };
    load();
    const t = setInterval(load, 15_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [address, enrolled]);

  // ───────────────── onchain balances ─────────────────
  useEffect(() => {
    if (!address || !RPC) return;
    const provider = new ethers.providers.JsonRpcProvider(RPC);
    const erc20 = new ethers.Contract(
      BALLN,
      ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
      provider
    );
    const erc721 = new ethers.Contract(BALLRZ, ["function balanceOf(address) view returns (uint256)"], provider);
    (async () => {
      try {
        const [raw, dec] = await Promise.all([erc20.balanceOf(address), erc20.decimals()]);
        const balNum = Number(raw.toString()) / 10 ** Number(dec);
        const nftNum = Number((await erc721.balanceOf(address)).toString());
        setBal(balNum);
        setNfts(nftNum);
      } catch {}
    })();
  }, [address]);

  // ───────────────── derived stats ─────────────────
  const speed = useMemo(() => tokenSpeedFactor(bal), [bal]); // not shown, but kept
  const boost = useMemo(() => boostFromNfts(nfts), [nfts]);
  const perDay = useMemo(() => dailyPoints(bal, nfts), [bal, nfts]);
  const daysToRedeem = useMemo(() => (perDay > 0 ? REDEEM_POINTS / perDay : Infinity), [perDay]);
  const pct = Math.min(1, points / REDEEM_POINTS);

  // ───────────────── actions ─────────────────
  const register = async () => {
    if (!address) return alert("Connect your wallet first.");
    try {
      const r = await fetch("/api/balln/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "Enroll failed");
      }
      setEnrolled(true);
      alert("Wallet registered for staking. Tracking has started!");
    } catch (e: any) {
      alert(e?.message || "Enroll failed");
    }
  };

  async function fetchNftImage(tokenId: string) {
    try {
      const res1 = await fetch(`/api/balln/tokenURI?tokenId=${tokenId}`);
      const { tokenUri } = await res1.json();
      const httpUri = String(tokenUri || "").replace(/^ipfs:\/\//, "https://ipfs.io/ipfs/");
      const meta = await fetch(httpUri).then((r) => r.json());
      return String(meta.image || "").replace(/^ipfs:\/\//, "https://ipfs.io/ipfs/");
    } catch {
      return "";
    }
  }

  const redeem = async () => {
    if (!address) return;
    if (!enrolled) return alert("Please register your wallet first.");
    setRedeeming(true);
    try {
      const r = await fetch("/api/balln/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Redeem failed");

      // IPFS can lag slightly
      await new Promise((res) => setTimeout(res, 3000));

      let imageUrl = "";
      if (j.tokenId) imageUrl = await fetchNftImage(String(j.tokenId));

      alert(`🎉 Welcome to Ballrz! Tx: ${j.txHash}${j.tokenId ? ` (Token #${j.tokenId})` : ""}`);
      if (imageUrl) window.open(imageUrl, "_blank");

      setPoints((p) => Math.max(0, p - REDEEM_POINTS));
    } catch (e: any) {
      alert(e?.message || "Redeem failed");
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <>
      {/* Inline retro theming + marquee + cursor */}
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=VT323&family=Share+Tech+Mono&display=swap");
        :root {
          --retro-font: "VT323", "Share Tech Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            "Liberation Mono", monospace;
        }
        html,
        body {
          background: #000;
          color: #fbedd4;
        }
        .retro {
          font-family: var(--retro-font);
          letter-spacing: 0.3px;
        }
        .accent {
          color: #f97316;
        }

        /* Bouncing ball (kept for header icon if you re-add it) */
        @keyframes ballX {
          0% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(calc(100vw - 80px));
          }
          100% {
            transform: translateX(0);
          }
        }
        .ball-bounce {
          animation: ballX 6.4s ease-in-out infinite;
        }

        /* Seamless marquee: two groups = continuous loop */
        .ticker {
          overflow: hidden;
          border-top: 1px solid rgba(234, 88, 12, 0.35);
          border-bottom: 1px solid rgba(234, 88, 12, 0.35);
          background: #000;
        }
        .ticker-rail {
          display: flex;
          width: max-content;
          animation: marquee var(--marquee-speed, 18s) linear infinite;
          will-change: transform;
        }
        .ticker-group {
          display: inline-flex;
          white-space: nowrap;
          gap: 2rem;
          padding: 6px 2rem;
          color: rgba(255, 166, 122, 0.9);
        }
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          } /* move by exactly one group's width (because we render two) */
        }

        /* Progress stripes */
        .stripes {
          background-image: repeating-linear-gradient(
            45deg,
            rgba(0, 0, 0, 0.15) 0,
            rgba(0, 0, 0, 0.15) 10px,
            rgba(255, 255, 255, 0.12) 10px,
            rgba(255, 255, 255, 0.12) 20px
          );
        }

        /* Blinking terminal cursor */
        .cursor {
          display: inline-block;
          width: 10px;
          height: 1.1em;
          vertical-align: -0.2em;
          background: #22c55e; /* green */
          margin-left: 6px;
          animation: blink 1s steps(1, end) infinite;
        }
        @keyframes blink {
          0%,
          50% {
            opacity: 1;
          }
          50.01%,
          100% {
            opacity: 0;
          }
        }
      `}</style>

      <div className="retro" style={{ minHeight: "100vh" }}>
        {/* ── Ticker (right → left, seamless) */}
        <div className="ticker">
          <div
            className="ticker-rail"
            style={
              {
                ["--marquee-speed" as any]: "16s", // ← adjust speed here (smaller = faster)
              } as any
            }
          >
            {/* group A */}
            <div className="ticker-group">
              <span>🏀 Hold $BALLN → earn points → redeem a Ballrz NFT!</span>
              <span>Base {BASE_DAILY_POINTS.toFixed(1)}/day at cap</span>
              <span>+0.5% per Ballrz up to +25%</span>
              <span>Cap speed at {SPEED_CAP_TOKENS} $BALLN</span>
              <span>Need {REDEEM_POINTS} points to mint</span>
            </div>
            {/* group B (duplicate for seamless loop) */}
            <div className="ticker-group" aria-hidden>
              <span>🏀 Hold $BALLN → earn points → redeem a Ballrz NFT!</span>
              <span>Base {BASE_DAILY_POINTS.toFixed(1)}/day at cap</span>
              <span>+0.5% per Ballrz up to +25%</span>
              <span>Cap speed at {SPEED_CAP_TOKENS} $BALLN</span>
              <span>Need {REDEEM_POINTS} points to mint</span>
            </div>
          </div>
        </div>

        {/* ── Content (left-aligned, no borders) */}
        <div style={{ maxWidth: 1100, marginLeft: 28, marginRight: 16, paddingTop: 18 }}>
          {/* Top row: back, title, wallet/connect/register */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <a href="/" style={{ color: "#7dd3fc", textDecoration: "underline" }}>
              ⬅ Back to Home
            </a>

            <h1 className="accent" style={{ fontSize: 40, fontWeight: 800, letterSpacing: 1, margin: "0 8px" }}>
              Welcome to $BALLN Self-Custody Staking!
            </h1>

            <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
              <ConnectWallet />
              <button
                onClick={register}
                disabled={!address || enrolled || checkingEnroll}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  fontWeight: 700,
                  border: "1px solid rgba(34,197,94,.6)",
                  background: enrolled ? "#374151" : "#10b981",
                  color: enrolled ? "#cbd5e1" : "#022c22",
                  cursor: !address || enrolled || checkingEnroll ? "not-allowed" : "pointer",
                  boxShadow: enrolled ? "none" : "0 0 12px rgba(16,185,129,.35)",
                }}
                title={
                  !address ? "Connect wallet" : enrolled ? "Already registered" : checkingEnroll ? "Checking…" : "Register wallet for tracking"
                }
              >
                {enrolled ? "Registered" : "Register Wallet for Tracking"}
              </button>
            </div>
          </div>

          {/* Subtitle */}
          <p style={{ marginTop: 10, lineHeight: 1.45 }}>
            Earn an NFT just by holding <span className="accent" style={{ fontWeight: 700 }}>$BALLN</span>. You need{" "}
            <span className="accent" style={{ fontWeight: 700 }}>
              {REDEEM_POINTS}
            </span>{" "}
            points for a Ballrz NFT. Base is{" "}
            <span className="accent" style={{ fontWeight: 700 }}>
              {BASE_DAILY_POINTS.toFixed(1)}
            </span>{" "}
            pts/day at cap ({SPEED_CAP_TOKENS} tokens). +0.5% per Ballrz (max +25%).
          </p>

          {/* Metrics row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 16, marginTop: 16 }}>
            <Metric label="Base/day @ cap" value={`${BASE_DAILY_POINTS.toFixed(2)} pts`} />
            <Metric label="Your /day" value={`${perDay.toFixed(2)} pts`} />
            <Metric label="Days to 3,333" value={isFinite(daysToRedeem) ? `${daysToRedeem.toFixed(1)} d` : "—"} />
            <Metric label="NFT boost" value={`${((boost - 1) * 100).toFixed(1)}%`} />
          </div>

          {/* Status + progress (no box/border, left aligned) */}
          <div style={{ marginTop: 24 }}>
            <h2 className="accent" style={{ fontSize: 24, marginBottom: 8 }}>
              Staking Status {status === "connected" && address ? `for ${address.slice(0, 6)}...${address.slice(-4)}` : ""}
            </h2>

            {!enrolled ? (
              <p style={{ marginTop: 6 }}>
                Connect your wallet and click <b>Register Wallet for Tracking</b> to start earning points.
              </p>
            ) : (
              <>
                <div style={{ fontSize: 17, lineHeight: 1.5 }}>
                  <Line label="Wallet status:" value={status === "connected" ? "✔ Wallet connected" : "✖ Not connected"} ok={status === "connected"} />
                  <Line label="$BALLN Balance:" value={bal.toFixed(4)} />
                  <Line label="Ballrz NFTs:" value={String(nfts)} />
                  <Line
                    label="Earning:"
                    value={`${perDay.toFixed(2)} points/day (cap ${BASE_DAILY_POINTS.toFixed(1)}/day; +${((boost - 1) * 100).toFixed(
                      1
                    )}% from NFTs)`}
                  />
                  <Line label="Time until NFT:" value={isFinite(daysToRedeem) ? `${daysToRedeem.toFixed(1)} days` : "—"} />
                </div>

                {/* Progress bar (no border) */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ height: 22, overflow: "hidden", background: "rgba(71, 37, 14, 0.4)", borderRadius: 12 }}>
                    <div
                      className="stripes"
                      style={{
                        height: "100%",
                        width: `${pct * 100}%`,
                        background: "#f97316",
                        transition: "width .7s ease-out",
                      }}
                    />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 14 }}>
                    Progress toward next NFT — {points.toFixed(2)} / {REDEEM_POINTS}
                  </div>
                </div>

                {/* Redeem */}
                <button
                  onClick={redeem}
                  disabled={!enrolled || points < REDEEM_POINTS || redeeming || status !== "connected"}
                  style={{
                    marginTop: 16,
                    padding: "10px 16px",
                    borderRadius: 10,
                    fontWeight: 700,
                    color: points >= REDEEM_POINTS && status === "connected" && enrolled ? "#000" : "#cbd5e1",
                    background: points >= REDEEM_POINTS && status === "connected" && enrolled ? "#f97316" : "#3f3f46",
                    cursor:
                      !enrolled || points < REDEEM_POINTS || redeeming || status !== "connected"
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {redeeming ? "Redeeming..." : "Redeem NFT"}
                </button>
              </>
            )}

            {/* Footnote */}
            <p style={{ marginTop: 18, fontSize: 12 }}>
              Once registered for staking, removal of $BALLN or Ballrz NFTs from this wallet will reset your earnings.
              Self-custody staking that allows earning another Ballrz by loyal $BALLN + NFT holders.
            </p>
          </div>

          {/* Terminal-style pulsing cursor footer */}
          <div style={{ marginTop: 26, fontSize: 16, color: "#22c55e" }}>
            READY<span className="cursor" />
          </div>
        </div>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="accent" style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", opacity: 0.9 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Line({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div>
      <span className="accent" style={{ opacity: 0.9 }}>
        {label}
      </span>{" "}
      <span style={{ color: ok ? "#22c55e" : "#fbedd4" }}>{value}</span>
    </div>
  );
}