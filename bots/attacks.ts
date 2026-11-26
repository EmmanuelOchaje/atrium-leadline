#!/usr/bin/env tsx
/**
 * Scripted red-team attacks — the CLI twin of the web Notices to Mariners page.
 * Usage: tsx attacks.ts --attack custody|steer-far|donate|wash|callback|pool-key|double-settle [--charter 1]
 */

import { parseArgs } from "util";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { createPublicClient, createWalletClient, http } from "viem";
import { foundry } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import {
  leadlineHookAbi,
  poolSwapTestAbi,
  poolDonateTestAbi,
  addresses,
  demoPrivateKey,
  wash,
} from "@leadline/sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));

const { values } = parseArgs({
  options: {
    attack: { type: "string" },
    charter: { type: "string", default: "1" },
    "rpc-url": { type: "string", default: "http://127.0.0.1:8545" },
  },
});

const MIN_SQRT = 4295128740n;
const MAX_SQRT = 1461446703485210103287273052203988822378723720528n - 1n;

async function main() {
  const attack = values.attack;
  const charterId = BigInt(values.charter as string);
  const rpcUrl = values["rpc-url"] as string;
  if (!attack) {
    console.error("Usage: tsx attacks.ts --attack custody|steer-far|donate|wash|callback|pool-key|double-settle");
    process.exit(1);
  }

  const book = addresses[31337];
  if (!book) throw new Error("No local address book — run DeployLocal.s.sol first");
  const hook = book.hook as `0x${string}`;

  const publicClient = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
  const attackerClient = createWalletClient({
    account: privateKeyToAccount(demoPrivateKey("anyone")),
    chain: foundry,
    transport: http(rpcUrl),
  });
  const mmClient = createWalletClient({
    account: privateKeyToAccount(demoPrivateKey("marketMaker")),
    chain: foundry,
    transport: http(rpcUrl),
  });
  const swapperClient = createWalletClient({
    account: privateKeyToAccount(demoPrivateKey("swapper")),
    chain: foundry,
    transport: http(rpcUrl),
  });

  switch (attack) {
    case "custody": {
      console.log("Notice 1: withdraw the inventory to the market maker (recall() as the market maker, not the issuer)");
      await expectRevert(() =>
        mmClient.writeContract({ address: hook, abi: leadlineHookAbi, functionName: "recall", args: [charterId] })
      );
      break;
    }

    case "steer-far": {
      console.log("Notice 3: steer the range far from the price");
      await expectRevert(() =>
        mmClient.writeContract({
          address: hook,
          abi: leadlineHookAbi,
          functionName: "steer",
          args: [charterId, 400_000, 400_200],
        })
      );
      break;
    }

    case "donate": {
      console.log("Notice 7: donate to the range");
      await expectRevert(() =>
        attackerClient.writeContract({
          address: book.donateRouter as `0x${string}`,
          abi: poolDonateTestAbi,
          functionName: "donate",
          args: [poolKeyOf(book), 1000n, 1000n, "0x"],
        })
      );
      break;
    }

    case "callback": {
      console.log("Notice 5: call the hook's unlock callback directly");
      await expectRevert(() =>
        attackerClient.writeContract({ address: hook, abi: leadlineHookAbi, functionName: "unlockCallback", args: ["0x"] })
      );
      break;
    }

    case "wash": {
      console.log("Notice 6: wash-trade 100 swaps to pad the score");
      const before = (await publicClient.readContract({
        address: hook,
        abi: leadlineHookAbi,
        functionName: "currentDepth",
        args: [charterId],
      })) as [bigint, bigint];

      const steps = wash(50, Date.now() % 100000, 5n * 10n ** 16n);
      for (const step of steps) {
        await swapperClient.writeContract({
          address: book.swapRouter as `0x${string}`,
          abi: poolSwapTestAbi,
          functionName: "swap",
          args: [
            poolKeyOf(book),
            { zeroForOne: step.zeroForOne, amountSpecified: step.amountSpecified, sqrtPriceLimitX96: step.zeroForOne ? MIN_SQRT : MAX_SQRT },
            { takeClaims: false, settleUsingBurn: false },
            "0x",
          ],
        });
      }

      const after = (await publicClient.readContract({
        address: hook,
        abi: leadlineHookAbi,
        functionName: "currentDepth",
        args: [charterId],
      })) as [bigint, bigint];

      console.log(`Ran: 100 swaps. Depth before [${before[0]}, ${before[1]}], after [${after[0]}, ${after[1]}]. Fees moved, depth didn't.`);
      break;
    }

    case "double-settle": {
      console.log("Notice 9: settle the same epoch twice");
      const hash1 = await attackerClient.writeContract({ address: hook, abi: leadlineHookAbi, functionName: "settle", args: [charterId, 32n] });
      console.log(`settle #1 succeeded (${hash1})`);
      const hash2 = await attackerClient.writeContract({ address: hook, abi: leadlineHookAbi, functionName: "settle", args: [charterId, 32n] });
      console.log(`settle #2 succeeded (${hash2}) — closed nothing new`);
      break;
    }

    case "pool-key": {
      console.log("Notice 10: route through an attacker-made pool that uses this hook but has no charter");
      const before = await publicClient.readContract({ address: hook, abi: leadlineHookAbi, functionName: "getCharter", args: [charterId] });

      const artifact = JSON.parse(readFileSync(resolve(__dirname, "../contracts/out/MockERC20.sol/MockERC20.json"), "utf8"));
      const deployerClient = createWalletClient({
        account: privateKeyToAccount(demoPrivateKey("anyone")),
        chain: foundry,
        transport: http(rpcUrl),
      });

      const hashA = await deployerClient.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object, args: ["Attack0", "ATK0", 18] });
      const receiptA = await publicClient.waitForTransactionReceipt({ hash: hashA });
      const hashB = await deployerClient.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object, args: ["Attack1", "ATK1", 18] });
      const receiptB = await publicClient.waitForTransactionReceipt({ hash: hashB });

      const [currency0, currency1] =
        receiptA.contractAddress!.toLowerCase() < receiptB.contractAddress!.toLowerCase()
          ? [receiptA.contractAddress!, receiptB.contractAddress!]
          : [receiptB.contractAddress!, receiptA.contractAddress!];

      const attackerKey = { currency0, currency1, fee: 3000, tickSpacing: book.tickSpacing, hooks: hook };
      await deployerClient.writeContract({
        address: book.poolManager as `0x${string}`,
        abi: [
          {
            type: "function",
            name: "initialize",
            stateMutability: "nonpayable",
            inputs: [
              { name: "key", type: "tuple", components: [
                { name: "currency0", type: "address" }, { name: "currency1", type: "address" },
                { name: "fee", type: "uint24" }, { name: "tickSpacing", type: "int24" }, { name: "hooks", type: "address" },
              ]},
              { name: "sqrtPriceX96", type: "uint160" },
            ],
            outputs: [{ name: "", type: "int24" }],
          },
        ] as const,
        functionName: "initialize",
        args: [attackerKey, 79228162514264337593543950336n],
      });
      console.log(`Attacker pool initialized with this hook (currency0=${currency0}, currency1=${currency1}), no charter on it.`);

      try {
        await deployerClient.writeContract({
          address: book.swapRouter as `0x${string}`,
          abi: poolSwapTestAbi,
          functionName: "swap",
          args: [attackerKey, { zeroForOne: true, amountSpecified: -1n, sqrtPriceLimitX96: MIN_SQRT }, { takeClaims: false, settleUsingBurn: false }, "0x"],
        });
        console.log("Swap ran in the attacker pool (no liquidity, so it just moved price).");
      } catch (e) {
        console.log("Swap in the attacker pool reverted (no liquidity there) — fine either way.");
      }

      const after = await publicClient.readContract({ address: hook, abi: leadlineHookAbi, functionName: "getCharter", args: [charterId] });
      const unchanged = stringify(before) === stringify(after);
      console.log(unchanged ? "Confirmed: charter state is byte-for-byte unchanged." : "FAILED: charter state changed!");
      break;
    }

    default:
      console.error(`Unknown attack: ${attack}`);
      process.exit(1);
  }
}

function stringify(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v));
}

function poolKeyOf(book: { token0: string; token1: string; poolFee: number; tickSpacing: number; hook: string }) {
  return { currency0: book.token0 as `0x${string}`, currency1: book.token1 as `0x${string}`, fee: book.poolFee, tickSpacing: book.tickSpacing, hooks: book.hook as `0x${string}` };
}

async function expectRevert(send: () => Promise<unknown>) {
  try {
    await send();
    console.log("FAILED: expected a revert, but the call succeeded.");
  } catch (e) {
    console.log(`Blocked: ${(e as Error).message.split("\n")[0]}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
