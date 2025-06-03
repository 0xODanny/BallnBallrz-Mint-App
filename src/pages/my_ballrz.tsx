// pages/my_ballrz.tsx

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAddress } from "@thirdweb-dev/react";
import { ethers } from "ethers";
import NFTCard from "@/components/NFTCard";
import TeamGrid from "@/components/TeamGrid";
import CONTRACT_ABI from "../../abi/ballrz.json";
import html2canvas from "html2canvas";

const MyBallrz = () => {
  const router = useRouter();
  const address = useAddress();
  const isConnected = !!address;
  const [nfts, setNfts] = useState<any[]>([]);
  const [teams, setTeams] = useState<{ [key: number]: any[] }>({});

  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.trim();
  const rpcUrl = process.env.NEXT_PUBLIC_AVAX_RPC?.trim();

  useEffect(() => {
    if (!isConnected || !address || !rpcUrl || !contractAddress) return;

    const loadNFTs = async () => {
      try {
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
        const totalSupply = await contract.totalSupply();

        const fetchNFTData = async (tokenId: number) => {
          try {
            const owner = await contract.ownerOf(tokenId);
            if (owner.toLowerCase() !== address.toLowerCase()) return null;

            const tokenURI = await contract.tokenURI(tokenId);
            const ipfsUrl = tokenURI.replace("ipfs://", "https://ipfs.io/ipfs/");
            const response = await fetch(ipfsUrl);
            const metadata = await response.json();

            return {
              tokenId: tokenId.toString(),
              image: metadata.image?.replace("ipfs://", "https://ipfs.io/ipfs/") || "",
              traits: (metadata.attributes || []).reduce((acc: any, attr: any) => {
                if (attr.trait_type && attr.value) {
                  acc[attr.trait_type.toLowerCase()] = attr.value;
                }
                return acc;
              }, {}),
            };
          } catch {
            return null;
          }
        };

        const tasks = Array.from({ length: totalSupply.toNumber() }, (_, i) => fetchNFTData(i + 1));
        const results = await Promise.all(tasks);
        setNfts(results.filter((nft) => nft !== null));
      } catch (err) {
        console.error("Error loading NFTs:", err);
      }
    };

    loadNFTs();
  }, [address]);

  const assignToTeam = (nft: any, teamNumber: number) => {
    setTeams((prev) => {
      const updated = { ...prev };
      const team = updated[teamNumber] || [];

      const alreadyInAnyTeam = Object.values(updated).some((t) =>
        t.some((item) => item.tokenId === nft.tokenId)
      );
      if (alreadyInAnyTeam) return prev;

      const isSpecial = ["golden basketball", "diamond basketball"].includes(
        nft.traits?.ball?.toLowerCase()
      );

      const hasSpecial = team.some((item) =>
        ["golden basketball", "diamond basketball"].includes(item.traits?.ball?.toLowerCase())
      );

      const hasUniform = team.some(
        (item) => item.traits?.uniform?.toLowerCase() === nft.traits?.uniform?.toLowerCase()
      );

      if (hasUniform || team.length >= 5 || (isSpecial && hasSpecial)) return prev;

      const regularPlayers = team.filter(
        (p) =>
          !["golden basketball", "diamond basketball"].includes(p.traits?.ball?.toLowerCase())
      );

      if (team.length === 4 && regularPlayers.length === 4 && !isSpecial) return prev;

      updated[teamNumber] = [...team, nft];
      return updated;
    });
  };

  const autoGenerateTeams = () => {
    if (!nfts.length) return;

    const shuffled = [...nfts].sort(() => Math.random() - 0.5);
    const newTeams: { [key: number]: any[] } = {};
    const usedIds = new Set();

    for (const nft of shuffled) {
      if (usedIds.has(nft.tokenId)) continue;

      for (let i = 1; i <= 10; i++) {
        const team = newTeams[i] || [];
        const uniforms = team.map((p) => p.traits?.uniform?.toLowerCase());
        const isSpecial = ["golden basketball", "diamond basketball"].includes(
          nft.traits?.ball?.toLowerCase()
        );
        const hasSpecial = team.some((p) =>
          ["golden basketball", "diamond basketball"].includes(p.traits?.ball?.toLowerCase())
        );
        const isDuplicateUniform = uniforms.includes(nft.traits?.uniform?.toLowerCase());

        if (isDuplicateUniform || team.length >= 5) continue;

        if (
          !isSpecial &&
          team.filter(
            (p) =>
              !["golden basketball", "diamond basketball"].includes(
                p.traits?.ball?.toLowerCase()
              )
          ).length >= 4
        )
          continue;

        if (isSpecial && hasSpecial) continue;

        newTeams[i] = [...team, nft];
        usedIds.add(nft.tokenId);
        break;
      }
    }

    setTeams(newTeams);
  };

  const handleScreenshot = async () => {
    const element = document.getElementById("team-layout");
    if (!element) return;

    element.scrollIntoView({ behavior: "auto", block: "center" });

    const images = Array.from(element.querySelectorAll("img"));
    await Promise.all(
      images.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              img.onload = img.onerror = () => resolve(null);
            })
      )
    );

    const canvas = await html2canvas(element, {
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#000000",
    });

    const link = document.createElement("a");
    link.download = "my-teams.png";
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div
      className="myballrz-page min-h-screen bg-cover bg-center bg-no-repeat bg-fixed text-white"
      style={{ backgroundImage: "url('/ballrz-bg-2.png')" }}
    >
      <div className="max-w-[1600px] w-full mx-auto p-4 bg-black/70 backdrop-blur-sm rounded-xl shadow-lg">
        {/* Back Button */}
        <button
          onClick={() => router.push("/")}
          className="mb-4 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
        >
          ← Back to Main
        </button>

        <h1
          className="text-3xl font-bold mb-4 !text-white drop-shadow-lg flex items-center gap-2"
          style={{ color: "#ffffff" }}
        >
          <span className="inline-block animate-spin-slow">🏀</span>
          <span>&nbsp;</span>
          My Balln Ballrz
        </h1>

        {!isConnected ? (
          <p className="text-white">Connect your wallet to see your Ballrz.</p>
        ) : (
          <>
            <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(180px,1fr))] mb-6">
              {nfts.map((nft) => (
                <NFTCard
                  key={nft.tokenId}
                  nft={nft}
                  onAssign={(team) => assignToTeam(nft, team)}
                />
              ))}
            </div>

            <div className="flex justify-end gap-4 mb-4">
              <button
                onClick={autoGenerateTeams}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                🔀 Auto-Generate Teams
              </button>
              <button
                onClick={handleScreenshot}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                📸 Screenshot Teams
              </button>
            </div>

            <div id="team-layout">
              <TeamGrid teams={teams} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MyBallrz;