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

  // --- check enrollment whenever wallet changes
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
      } finally {
        if (!ignore) setCheckingEnroll(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [address]);

  // --- poll points ONLY if enrolled
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
    const t = setInterval(load, 15000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [address, enrolled]);

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

  // --- register
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

  // --- redeem
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
      {/* ✅ Retro inline theme */}
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=VT323&family=Share+Tech+Mono&display=swap");
        :root {
          --retro-font: "VT323", "Share Tech Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        }
        html,
        body {
          background: #000;
          color: #e5e7eb;
        }
        .retro {
          font-family: var(--retro-font);
        }
        .accent {
          color: #f97316;
        }
        .muted {
          color: #fbedd4;
        }
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .marquee-track {
          white-space: nowrap;
          padding-left: 100%;
          animation: marquee var(--marquee-speed, 20s) linear infinite;
        }
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
        .stripes {
          background-image: repeating-linear-gradient(
            45deg,
            rgba(0, 0, 0, 0.15) 0,
            rgba(0, 0, 0, 0.15) 10px,
            rgba(255, 255, 255, 0.12) 10px,
            rgba(255, 255, 255, 0.12) 20px
          );
        }
        .pad {
          padding: 24px;
        }
        .gap8 > * + * {
          margin-top: 8px;
        }
        .gap12 > * + * {
          margin-top: 12px;
        }
        .gap16 > * + * {
          margin-top: 16px;
        }
        .gap24 > * + * {
          margin-top: 24px;
        }
        .rounded {
          border-radius: 14px;
        }
        .card {
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(234, 88, 12, 0.4);
        }
        .thin-border {
          border: 1px solid rgba(148, 163, 184, 0.3);
        }
      `}</style>

      <div className="retro" style={{ minHeight: "100vh" }}>
        {/* Header row */}
        <div className="pad" style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <a href="/" style={{ color: "#7dd3fc", textDecoration: "underline" }}>
              ⬅ Back to Home
            </a>

            <h1 className="accent" style={{ fontSize: 40, fontWeight: 800, letterSpacing: 1, textAlign: "center", flex: 1 }}>
              Welcome to $BALLN Self-Custody Staking!
            </h1>

            {/* ✅ Wallet connect + Register */}
            <div style={{ display: "flex", gap: 8 }}>
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
              >
                {enrolled ? "Registered" : "Register Wallet for Tracking"}
              </button>
            </div>
          </div>

          {/* Status card */}
          <div className="card rounded pad gap12" style={{ marginTop: 28 }}>
            <h2 className="accent" style={{ fontSize: 24, marginBottom: 6 }}>
              Staking Status {status === "connected" && address ? `for ${address.slice(0, 6)}...${address.slice(-4)}` : ""}
            </h2>

            {!enrolled ? (
              <p className="muted" style={{ marginTop: 6 }}>
                Connect your wallet and click <b>Register Wallet for Tracking</b> to start earning points.
              </p>
            ) : (
              <>
                <div className="gap8" style={{ fontSize: 17, lineHeight: 1.5 }}>
                  <Line label="Wallet status:" value={status === "connected" ? "✔ Wallet connected" : "✖ Not connected"} ok={status === "connected"} />
                  <Line label="$BALLN Balance:" value={bal.toFixed(4)} />
                  <Line label="Ballrz NFTs:" value={String(nfts)} />
                  <Line label="Earning:" value={`${perDay.toFixed(2)} points/day (cap ${BASE_DAILY_POINTS.toFixed(1)}/day; +${((boost - 1) * 100).toFixed(1)}% from NFTs)`} />
                  <Line label="Time until NFT:" value={isFinite(daysToRedeem) ? `${daysToRedeem.toFixed(1)} days` : "—"} />
                </div>

                {/* Progress */}
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
                  disabled={!enrolled || points < REDEEM_POINTS || redeeming || status !== "connected"}
                  style={{
                    marginTop: 16,
                    padding: "10px 16px",
                    borderRadius: 10,
                    fontWeight: 700,
                    color: points >= REDEEM_POINTS && status === "connected" && enrolled ? "#000" : "#cbd5e1",
                    background: points >= REDEEM_POINTS && status === "connected" && enrolled ? "#f97316" : "#3f3f46",
                    cursor: !enrolled || points < REDEEM_POINTS || redeeming || status !== "connected" ? "not-allowed" : "pointer",
                  }}
                >
                  {redeeming ? "Redeeming..." : "Redeem NFT"}
                </button>
              </>
            )}

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