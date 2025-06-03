// src/utils/teamLogic.ts
export const isGoldenOrDiamond = (ball: string) => {
  return ball === "Golden Basketball" || ball === "Diamond Basketball";
};

export const hasUniqueUniforms = (nfts: any[]) => {
  const uniforms = nfts.map(n => n.traits.uniform);
  return new Set(uniforms).size === uniforms.length;
};

export const isFullTeam = (nfts: any[]) => {
  if (nfts.length !== 5) return false;

  const [first4, last] = [nfts.slice(0, 4), nfts[4]];
  const allUnique = hasUniqueUniforms([...first4, last]);

  return (
    isGoldenOrDiamond(last.traits.ball) &&
    allUnique &&
    hasUniqueUniforms(first4)
  );
};