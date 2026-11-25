import { createConfig, http } from "wagmi";
import { foundry } from "wagmi/chains";

// `foundry` is chain id 31337 — anvil's default local chain.
export const wagmiConfig = createConfig({
  chains: [foundry],
  transports: {
    [foundry.id]: http("http://127.0.0.1:8545"),
  },
  ssr: true,
});
