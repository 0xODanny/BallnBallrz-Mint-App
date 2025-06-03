// src/components/TeamGrid.tsx

type Props = {
  teams: { [key: number]: any[] };
};

const TeamGrid = ({ teams }: Props) => {
  const isValidTeam = (team: any[]) => {
    if (team.length !== 5) return false;

    const uniforms = new Set<string>();
    let specialCount = 0;

    for (const player of team) {
      const uniform = player.traits?.uniform?.toLowerCase();
      const ball = player.traits?.ball?.toLowerCase();

      if (!uniform) return false;
      uniforms.add(uniform);

      if (ball === "golden basketball" || ball === "diamond basketball") {
        specialCount++;
      }
    }

    return uniforms.size === 5 && specialCount === 1;
  };

  return (
    <div
      className="w-full bg-cover bg-center p-4"
      style={{ backgroundImage: "url('/ballrz-bg-2.png')" }}
    >
      <div className="flex flex-wrap gap-4 justify-center">
        {[...Array(10)].map((_, i) => {
          const teamNum = i + 1;
          const team = teams[teamNum] || [];
          const full = isValidTeam(team);

          const special = team.find((nft) => {
            const ball = nft.traits?.ball?.toLowerCase();
            return ball === "golden basketball" || ball === "diamond basketball";
          });

          const regulars = team.filter((nft) => {
            const ball = nft.traits?.ball?.toLowerCase();
            return ball !== "golden basketball" && ball !== "diamond basketball";
          });

          const ordered = [...regulars, ...(special ? [special] : [])];

          return (
            <div
              key={teamNum}
              className="w-[260px] shadow p-3 rounded-xl"
              style={{
                backgroundColor: "white",
                border: "2px solid #ccc",
              }}
            >
              <h2
                className="text-center text-base font-bold mb-3 font-sans"
                style={{ color: full ? "#16a34a" : "#1f2937" }}
              >
                Team {teamNum} {full ? "✓" : ""}
              </h2>

              <div className="flex flex-wrap justify-center gap-2">
                {ordered.map((nft, idx) => {
                  const ball = nft.traits?.ball?.toLowerCase();
                  const isSpecial = ball === "golden basketball" || ball === "diamond basketball";
                  const isFifth = idx === 4;

                  const borderStyle = isFifth
                    ? isSpecial
                      ? "border-yellow-500 border-2"
                      : "border-red-400 border-2"
                    : "border-gray-300";

                  return (
                    <div
                      key={nft.tokenId}
                      className={`w-[72px] ${borderStyle} rounded bg-white p-1 transform hover:scale-[1.05] hover:-translate-y-[2px] transition duration-300 ease-in-out`}
                      style={{ backgroundColor: "white" }}
                    >
                      <img
                        src={nft.image}
                        alt={`#${nft.tokenId}`}
                        className="w-full h-[72px] object-contain rounded mb-1"
                      />
                      <div className="text-[10px] font-medium text-center text-black font-sans">
                        #{nft.tokenId}
                      </div>
                      <div className="text-[9px] text-gray-800 text-center font-sans">
                        {nft.traits.uniform}
                      </div>
                      <div className="text-[9px] text-gray-800 text-center font-sans">
                        {nft.traits.ball}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TeamGrid;