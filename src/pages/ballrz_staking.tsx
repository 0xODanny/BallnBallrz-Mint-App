// src/pages/ballrz_staking.tsx
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
  const conn = useConnectionStatus();

  const [bal, setBal] = useState(0);     // $BALLN token balance
  const [nfts, setNfts] = useState(0);   // Ballrz NFT balance
  const [points, setPoints] = useState(0);
  const [redeeming, setRedeeming] = useState(false);

  // auto-enroll when wallet connects
  useEffect(() => {
    if (!address) return;
    fetch("/api/balln/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: address }),
    }).catch(() => {});
  }, [address]);

  // fetch live points (poll)
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
    return () => { stop = true; clearInterval(t); };
  }, [address]);

  // read on-chain balances for rate preview
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

  const speed = useMemo(() => tokenSpeedFactor(bal), [bal]);
  const boost = useMemo(() => boostFromNfts(nfts), [nfts]);
  const perDay = useMemo(() => dailyPoints(bal, nfts), [bal, nfts]);
  const pct = Math.min(1, points / REDEEM_POINTS);
  const daysToRedeem = useMemo(
    () => (perDay > 0 ? REDEEM_POINTS / perDay : Infinity),
    [perDay]
  );

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
    <div className="min-h-screen bg-black text-orange-200">
      {/* top banner with bouncing ball + CRT scanlines */}
      <div className="relative overflow-hidden h-20 border-b border-orange-700/40 crt-scan">
        <div className="absolute top-2 animate-ball-bounce">
          <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
            <circle cx="32" cy="32" r="28" fill="#EA580C" stroke="#7C2D12" strokeWidth="4" />
            <path d="M4 32h56M32 4v56M12 12c28 18 28 22 40 40M52 12c-28 18-28 22-40 40"
                  stroke="#7C2D12" strokeWidth="3" fill="none" />
          </svg>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-6">
        {/* back to home */}
        <div className="mb-4">
          <a href="/" className="inline-block bg-sky-400 text-black font-bold px-3 py-2 rounded-md">
            ⬅ Back to Home
          </a>
        </div>

        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-3xl font-bold tracking-widest text-orange-400">BALLRZ STAKING TERMINAL</h1>
          <ConnectWallet />
        </div>

        <p className="text-sm text-orange-300/80 mb-6">
          Earn points by holding <span className="text-orange-400 font-semibold">$BALLN</span>.
          Redeem <span className="text-orange-400 font-semibold">{REDEEM_POINTS}</span> points for a Ballrz NFT.
          +0.5% boost per Ballrz (max +25%). Earnings cap at <span className="font-semibold">{SPEED_CAP_TOKENS}</span> tokens.
        </p>

        {/* live balances + rate preview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-orange-950/30 border border-orange-800/40 rounded-2xl p-4">
            <div className="text-xs uppercase tracking-widest text-orange-400/80">$BALLN Balance</div>
            <div className="mt-2 text-xl font-mono">{bal.toFixed(4)}</div>
            <div className="mt-1 text-sm">Speed: {(speed * 100).toFixed(1)}% (cap {SPEED_CAP_TOKENS})</div>
          </div>

          <div className="bg-orange-950/30 border border-orange-800/40 rounded-2xl p-4">
            <div className="text-xs uppercase tracking-widest text-orange-400/80">Ballrz NFTs</div>
            <div className="mt-2 text-xl font-mono">{nfts}</div>
            <div className="mt-1 text-sm">Boost: {((boost - 1) * 100).toFixed(1)}% (max 25%)</div>
          </div>
        </div>

        {/* metrics */}
        <div className="bg-orange-950/30 border border-orange-800/40 rounded-2xl p-4 mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <Metric label="Base/day @ cap" value={`${BASE_DAILY_POINTS.toFixed(2)} pts`} />
            <Metric label="Your /day" value={`${perDay.toFixed(2)} pts`} />
            <Metric label="Days to 3,333" value={isFinite(daysToRedeem) ? `${daysToRedeem.toFixed(1)} d` : "–"} />
            <Metric label="NFT boost" value={`${((boost - 1) * 100).toFixed(1)}%`} />
          </div>
        </div>

        {/* progress (live points from DB) */}
        <Progress label="Progress to next Ballrz" value={pct} />
        <div className="text-xs text-orange-300/70 mt-2">
          {conn === "connected"
            ? `${points.toFixed(2)} / ${REDEEM_POINTS} pts`
            : "Connect your wallet to load your progress."}
        </div>

        {/* redeem */}
        <div className="mt-6">
          <button
            onClick={redeem}
            disabled={points < REDEEM_POINTS || redeeming || conn !== "connected"}
            className={`px-4 py-2 rounded-md font-bold text-black ${
              points >= REDEEM_POINTS ? "bg-orange-500 hover:bg-orange-600" : "bg-neutral-600 cursor-not-allowed"
            }`}
          >
            {redeeming ? "Redeeming..." : "Redeem NFT"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-black/60 border border-orange-900/40">
      <div className="text-[10px] uppercase tracking-widest text-orange-400/70">{label}</div>
      <div className="text-xl font-mono text-orange-200 mt-1">{value}</div>
    </div>
  );
}

function Progress({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="bg-black/60 border border-orange-900/40 rounded-2xl p-4">
      <div className="text-xs text-orange-300/80 mb-2">{label}</div>
      <div className="h-4 rounded-full bg-orange-950/40 overflow-hidden">
        <div className="h-full bg-orange-600" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}