type Props = {
  nft: any;
  onAssign: (teamNumber: number) => void;
};

const NFTCard = ({ nft, onAssign }: Props) => {
  return (
    <div
      className="w-full max-w-[180px] border border-gray-400 rounded-xl shadow p-2 text-center text-xs flex flex-col items-center space-y-1
                 transform hover:scale-[1.03] hover:-translate-y-1 hover:shadow-xl transition duration-300"
      style={{
        backgroundColor: "#ffffff", // Solid white background
        color: "#000000",           // Solid black text
      }}
    >
      <img
        src={nft.image}
        alt={`#${nft.tokenId}`}
        className="w-[120px] h-[120px] object-contain rounded-md border border-gray-300"
      />
      <div className="font-bold text-xs mt-1">#{nft.tokenId}</div>
      <div className="text-[10px]">Uniform: {nft.traits.uniform}</div>
      <div className="text-[10px]">Ball: {nft.traits.ball}</div>

      <select
        onChange={(e) => onAssign(Number(e.target.value))}
        className="w-full border border-gray-400 rounded p-1 text-xs mt-1 bg-white text-black"
        defaultValue=""
      >
        <option value="" disabled>
          ➕ Assign to Team
        </option>
        {[...Array(10)].map((_, i) => (
          <option key={i} value={i + 1}>
            Team {i + 1}
          </option>
        ))}
      </select>
    </div>
  );
};

export default NFTCard;