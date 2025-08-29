// src/utils/ballnStaking.ts
export const BALLN_SUPPLY = 100_000;
export const REDEEM_POINTS = 3_333;
export const TARGET_DAYS = 28;
export const BASE_DAILY_POINTS = REDEEM_POINTS / TARGET_DAYS; // ≈119.0357
export const SPEED_CAP_TOKENS = BALLN_SUPPLY * 0.01; // 1% = 1,000

export function boostFromNfts(ballrzCount: number) {
  const boost = 0.005 * (Number(ballrzCount) || 0);
  return 1 + Math.min(boost, 0.25);
}

export function tokenSpeedFactor(ballnBalance: number) {
  const effective = Math.min(Number(ballnBalance) || 0, SPEED_CAP_TOKENS);
  return SPEED_CAP_TOKENS === 0 ? 0 : effective / SPEED_CAP_TOKENS; // 0..1
}

export function dailyPoints(ballnBalance: number, ballrzCount: number) {
  const base = BASE_DAILY_POINTS * tokenSpeedFactor(ballnBalance);
  return base * boostFromNfts(ballrzCount);
}

export function accruePoints(
  lastPoints: number,
  lastMs: number,
  nowMs: number,
  ballnBalance: number,
  ballrzCount: number
) {
  const perDay = dailyPoints(ballnBalance, ballrzCount);
  const perSec = perDay / 86400;
  const dt = Math.max(0, (nowMs - lastMs) / 1000);
  return (Number(lastPoints) || 0) + perSec * dt;
}