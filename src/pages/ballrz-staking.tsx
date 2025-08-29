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

  // enroll once
  useEffect(() => {
    if (!address) return;
    fetch("/api/balln/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: address }),
    }).catch(() => {});
  }, [address]);

  // fetch live points
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

  // onchain balances → like rpepe sidebar stats
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

  // calc (same math as rpepe page, different constants)
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
    <div className="min-h-screen bg-black text-orange-400">
      {/* banner like rpepe, orange theme + bouncing ball + CRT scan */}
      <div className="relative overflow-hidden h-16 border-b border-orange-700/50 crt-scan">
        <div className="absolute top-1 animate-ball-bounce">
          <svg width="56" height="56" viewBox="0 0 64 64" aria-hidden>
            <circle cx="32" cy="32" r="28" fill="#EA580C" stroke="#7C2D12" strokeWidth="4" />
            <path d="M4 32h56M32 4v56M12 12c28 18 28 22 40 40M52 12c-28 18-28 22-40 40"
              stroke="#7C2D12" strokeWidth="3" fill="none" />
          </svg>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* top row: back + title + wallet chip */}
        <div className="flex items-center justify-between gap-3">
          <a href="/" className="text-sky-300 hover:underline">⬅ Back to Home</a>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-widest text-orange-500">
            Welcome to $BALLN Self-Custody Staking!
          </h1>
          <ConnectWallet />
        </div>

        <p className="mt-4 text-orange-300">
          Earn an NFT just by holding <span className="text-orange-400 font-semibold">$BALLN</span>!
          You need <span className="font-bold">{REDEEM_POINTS}</span> points for a Ballrz NFT.
          Base is <span className="font-bold">{BASE_DAILY_POINTS.toFixed(1)}</span> pts/day at cap ({SPEED_CAP_TOKENS} tokens).
          +0.5% per Ballrz (max +25%).
        </p>

        {/* status box like rpepe */}
        <div className="mt-6 bg-black/70 rounded-lg border border-orange-800/60 p-4 md:p-6">
          <h2 className="font-mono text-xl md:text-2xl text-orange-400 mb-3">
            Staking Status {status === "connected" && address ? `for ${address.slice(0,6)}...${address.slice(-4)}` : ""}
          </h2>

          <div className="space-y-3 font-mono text-[15px]">
            <Line label="Wallet status:" value={status === "connected" ? "✔ Wallet connected" : "✖ Not connected"} ok={status === "connected"} />
            <Line label="$BALLN Balance:" value={bal.toFixed(4)} />
            <Line label="Ballrz NFTs:" value={String(nfts)} />
            <Line
              label="Earning:"
              value={`${perDay.toFixed(2)} points/day  (base capped at ${BASE_DAILY_POINTS.toFixed(1)}/day; +${((boost-1)*100).toFixed(1)}% from NFTs)`}
            />
            <Line
              label="Time until NFT:"
              value={isFinite(daysToRedeem) ? `${daysToRedeem.toFixed(1)} days` : "—"}
            />
          </div>

          {/* progress bar like rpepe */}
          <div className="mt-4">
            <div className="h-5 rounded bg-orange-900/40 overflow-hidden border border-orange-800/70">
              <div
                className="h-full bg-orange-500"
                style={{ width: `${pct * 100}%`, transition: "width .5s ease" }}
              />
            </div>
            <div className="text-sm text-orange-300 mt-1 font-mono">
              Progress toward next NFT — {points.toFixed(2)} / {REDEEM_POINTS}
            </div>
          </div>

          {/* redeem button */}
          <div className="mt-4">
            <button
              onClick={redeem}
              disabled={points < REDEEM_POINTS || redeeming || status !== "connected"}
              className={`px-4 py-2 rounded-md font-bold text-black ${
                points >= REDEEM_POINTS ? "bg-orange-500 hover:bg-orange-600" : "bg-neutral-600 cursor-not-allowed"
              }`}
            >
              {redeeming ? "Redeeming..." : "Redeem NFT"}
            </button>
          </div>

          <p className="mt-6 text-xs text-orange-300/80 font-mono">
            Once registered for staking, removal of $BALLN or Ballrz NFTs from this wallet will reset your earnings.
            Self-custody staking that allows earning another Ballrz by loyal $BALLN + NFT holders.
          </p>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div>
      <span className="text-orange-300">{label}</span>{" "}
      <span className={ok ? "text-green-400" : "text-orange-400"}>{value}</span>
    </div>
  );
}