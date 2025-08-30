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

  const [bal, setBal] = useState(0);
  const [nfts, setNfts] = useState(0);
  const [points, setPoints] = useState(0);
  const [redeeming, setRedeeming] = useState(false);

  // --- enroll once
  useEffect(() => {
    if (!address) return;
    fetch("/api/balln/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: address }),
    }).catch(() => {});
  }, [address]);

  // --- poll points
  useEffect(() => {
    if (!address) return;
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/balln/points?wallet=${address}`);
        const j = await r.json();
        if (!stop) setPoints(Number(j.points || 0));
      } catch {}
    };
    load();
    const t = setInterval(load, 15000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [address]);

  // --- onchain balances
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

  // --- derived stats
  const speed = useMemo(() => tokenSpeedFactor(bal), [bal]);
  const boost = useMemo(() => boostFromNfts(nfts), [nfts]);
  const perDay = useMemo(() => dailyPoints(bal, nfts), [bal, nfts]);
  const daysToRedeem = useMemo(() => (perDay > 0 ? REDEEM_POINTS / perDay : Infinity), [perDay]);
  const pct = Math.min(1, points / REDEEM_POINTS);

  const redeem = async () => {
    if (!address) return;
    setRedeeming(true);
    try {
      const r = await fetch("/api/balln/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address }),
      });
      const j = await r.json();
      if (j.ok) {
        alert(`Minted! Tx: ${j.txHash}`);
        setPoints((p) => Math.max(0, p - REDEEM_POINTS));
      } else {
        alert(j.error || "Redeem failed");
      }
    } catch (e: any) {
      alert(e?.message || "Redeem failed");
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <>
      {/* 🔧 INLINE GLOBAL CSS (temporary, to guarantee styling takes) */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=VT323&family=Share+Tech+Mono&display=swap');
        :root { --retro-font: "VT323","Share Tech Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace; }
        html,body { background:#000; color:#e5e7eb; }
        .retro { font-family: var(--retro-font); }
        .accent { color:#f97316; } /* orange-500 */
        .muted  { color:#fbedd4; } /* warm light text */

        /* marquee */
        @keyframes marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .marquee-track { white-space:nowrap; padding-left:100%; animation:marquee 30s linear infinite; }

        /* bouncing ball */
        @keyframes ballX { 0%{transform:translateX(0)} 50%{transform:translateX(calc(100vw - 80px))} 100%{transform:translateX(0)} }
        .ball-bounce { animation: ballX 6.4s ease-in-out infinite; }

        /* stripes on progress fill */
        .stripes {
          background-image: repeating-linear-gradient(45deg,
            rgba(0,0,0,.15) 0, rgba(0,0,0,.15) 10px,
            rgba(255,255,255,.12) 10px, rgba(255,255,255,.12) 20px);
        }

        /* simple spacing helpers (so we don't rely on Tailwind here) */
        .pad { padding: 24px; }
        .gap8 > * + * { margin-top: 8px; }
        .gap12 > * + * { margin-top: 12px; }
        .gap16 > * + * { margin-top: 16px; }
        .gap24 > * + * { margin-top: 24px; }
        .rounded { border-radius: 14px; }
        .card { background: rgba(0,0,0,0.6); border: 1px solid rgba(234,88,12,.4); }
        .thin-border { border: 1px solid rgba(148,163,184,.3); } /* slate-400/30 */
      `}</style>

      <div className="retro" style={{ minHeight: "100vh" }}>
        {/* Banner with bouncing ball */}
        <div style={{ position: "relative", overflow: "hidden", height: 64, borderBottom: "1px solid rgba(234,88,12,.4)" }}>
          <div className="ball-bounce" style={{ position: "absolute", top: 6 }}>
            <svg width="56" height="56" viewBox="0 0 64 64" aria-hidden>
              <circle cx="32" cy="32" r="28" fill="#EA580C" stroke="#7C2D12" strokeWidth="4" />
              <path d="M4 32h56M32 4v56M12 12c28 18 28 22 40 40M52 12c-28 18-28 22-40 40" stroke="#7C2D12" strokeWidth="3" fill="none" />
            </svg>
          </div>
        </div>

        {/* Ticker */}
        <div style={{ overflow: "hidden", borderTop: "1px solid rgba(234,88,12,.5)", borderBottom: "1px solid rgba(234,88,12,.5)" }}>
          <div
  className="marquee-track accent"
  style={{
    paddingTop: 6,
    paddingBottom: 6,
    ["--marquee-speed" as any]: "4s", // 👈 change this value to control speed
  }}
>
            <span style={{ margin: "0 2rem" }}>🏀 Hold $BALLN → earn points → redeem a Ballrz NFT!</span>
            <span style={{ margin: "0 2rem" }}>Base {BASE_DAILY_POINTS.toFixed(1)}/day at cap • +0.5% per Ballrz up to +25%.</span>
            <span style={{ margin: "0 2rem" }}>Cap speed at {SPEED_CAP_TOKENS} $BALLN.</span>
            <span style={{ margin: "0 2rem" }}>Need {REDEEM_POINTS} points to mint.</span>
            {/* duplicate to make the loop seamless */}
            <span style={{ margin: "0 2rem" }}>🏀 Hold $BALLN → earn points → redeem a Ballrz NFT!</span>
            <span style={{ margin: "0 2rem" }}>Base {BASE_DAILY_POINTS.toFixed(1)}/day at cap • +0.5% per Ballrz up to +25%.</span>
            <span style={{ margin: "0 2rem" }}>Cap speed at {SPEED_CAP_TOKENS} $BALLN.</span>
            <span style={{ margin: "0 2rem" }}>Need {REDEEM_POINTS} points to mint.</span>
          </div>
        </div>

        {/* Header row */}
        <div className="pad" style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <a href="/" style={{ color: "#7dd3fc", textDecoration: "underline" }}>⬅ Back to Home</a>
            <h1 className="accent" style={{ fontSize: 40, fontWeight: 800, letterSpacing: 1, textAlign: "center", flex: 1 }}>
              Welcome to $BALLN Self-Custody Staking!
            </h1>
            <div style={{ flexShrink: 0 }}>
              <ConnectWallet />
            </div>
          </div>

          {/* Subtitle */}
          <p className="muted" style={{ marginTop: 16, lineHeight: 1.5 }}>
            Earn an NFT just by holding <span className="accent" style={{ fontWeight: 700 }}>$BALLN</span>. You need{" "}
            <span className="accent" style={{ fontWeight: 700 }}>{REDEEM_POINTS}</span> points for a Ballrz NFT.
            Base is <span className="accent" style={{ fontWeight: 700 }}>{BASE_DAILY_POINTS.toFixed(1)}</span> pts/day at cap ({SPEED_CAP_TOKENS} tokens). +0.5% per Ballrz (max +25%).
          </p>

          {/* Metrics row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 16, marginTop: 24 }}>
            <Metric label="Base/day @ cap" value={`${BASE_DAILY_POINTS.toFixed(2)} pts`} />
            <Metric label="Your /day" value={`${perDay.toFixed(2)} pts`} />
            <Metric label="Days to 3,333" value={isFinite(daysToRedeem) ? `${daysToRedeem.toFixed(1)} d` : "—"} />
            <Metric label="NFT boost" value={`${((boost - 1) * 100).toFixed(1)}%`} />
          </div>

          {/* Status card */}
          <div className="card rounded pad gap12" style={{ marginTop: 28 }}>
            <h2 className="accent" style={{ fontSize: 24, marginBottom: 6 }}>
              Staking Status {status === "connected" && address ? `for ${address.slice(0,6)}...${address.slice(-4)}` : ""}
            </h2>

            <div className="gap8" style={{ fontSize: 17, lineHeight: 1.5 }}>
              <Line label="Wallet status:" value={status === "connected" ? "✔ Wallet connected" : "✖ Not connected"} ok={status === "connected"} />
              <Line label="$BALLN Balance:" value={bal.toFixed(4)} />
              <Line label="Ballrz NFTs:" value={String(nfts)} />
              <Line label="Earning:" value={`${perDay.toFixed(2)} points/day (cap ${BASE_DAILY_POINTS.toFixed(1)}/day; +${((boost - 1) * 100).toFixed(1)}% from NFTs)`} />
              <Line label="Time until NFT:" value={isFinite(daysToRedeem) ? `${daysToRedeem.toFixed(1)} days` : "—"} />
            </div>

            {/* Progress bar */}
            <div style={{ marginTop: 16 }}>
              <div className="thin-border rounded" style={{ height: 22, overflow: "hidden", background: "rgba(71, 37, 14, 0.4)" }}>
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
              <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
                Progress toward next NFT — {points.toFixed(2)} / {REDEEM_POINTS}
              </div>
            </div>

            {/* Redeem */}
            <button
              onClick={redeem}
              disabled={points < REDEEM_POINTS || redeeming || status !== "connected"}
              style={{
                marginTop: 16,
                padding: "10px 16px",
                borderRadius: 10,
                fontWeight: 700,
                color: points >= REDEEM_POINTS && status === "connected" ? "#000" : "#cbd5e1",
                background: points >= REDEEM_POINTS && status === "connected" ? "#f97316" : "#3f3f46",
                cursor: points >= REDEEM_POINTS && status === "connected" ? "pointer" : "not-allowed",
              }}
            >
              {redeeming ? "Redeeming..." : "Redeem NFT"}
            </button>

            <p className="muted" style={{ marginTop: 18, fontSize: 12 }}>
              Once registered for staking, removal of $BALLN or Ballrz NFTs from this wallet will reset your earnings.
              Self-custody staking that allows earning another Ballrz by loyal $BALLN + NFT holders.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="card rounded pad" style={{ paddingTop: 12, paddingBottom: 12 }}>
      <div className="accent" style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", opacity: 0.9 }}>
        {label}
      </div>
      <div className="muted" style={{ fontSize: 22, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Line({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div>
      <span className="accent" style={{ opacity: 0.9 }}>{label}</span>{" "}
      <span style={{ color: ok ? "#22c55e" : "#fbedd4" }}>{value}</span>
    </div>
  );
}