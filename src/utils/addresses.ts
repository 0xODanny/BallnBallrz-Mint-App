export const BALLN_TOKEN_ADDRESS =
  process.env.BALLN_TOKEN_ADDRESS ||
  process.env.NEXT_PUBLIC_BALLN_TOKEN_ADDRESS ||
  '0x4Afc7838167b77530278483c3d8c1fFe698a912E'; // fallback

export const BALLRZ_NFT_ADDRESS =
  process.env.CONTRACT_ADDRESS ||                      // server
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||          // client
  process.env.NEXT_PUBLIC_BALLRZ_CONTRACT_ADDRESS ||   // optional future env
  '0x6b2b14002614292f99f9e09b94b59af396eac27d';        // fallback

export const RPC_PUBLIC = process.env.NEXT_PUBLIC_AVAX_RPC!;
export const RPC_SERVER = process.env.AVAX_RPC || process.env.NEXT_PUBLIC_AVAX_RPC!;
export const POSTGRES_URL = process.env.POSTGRES_URL!; // BallnBallrz DB