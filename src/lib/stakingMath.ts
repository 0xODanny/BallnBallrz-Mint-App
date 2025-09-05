// src/lib/stakingMath.ts
export const REDEEM_POINTS = 3333;
export const SPEED_CAP_TOKENS = 1000;      // 1% of 100,000
export const BASE_DAILY_POINTS = 119.0;    // ~= 28 days to 3333 (tune to your exact daily target)

/** 0..1, cap at 1000 BALLN */
export function tokenSpeedFactor(balln: number) {
  return Math.min(1, Math.max(0, balln / SPEED_CAP_TOKENS));
}
/** 1.0 .. 1.25 (0.5% each up to 25%) */
export function boostFromNfts(nfts: number) {
  const pct = Math.min(25, nfts * 0.5);
  return 1 + pct / 100;
}
/** points/day right now */
export function dailyPoints(balln: number, nfts: number) {
  return BASE_DAILY_POINTS * tokenSpeedFactor(balln) * boostFromNfts(nfts);
}