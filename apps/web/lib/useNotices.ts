"use client";

import { useState } from "react";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "wagmi/chains";
import {
  leadlineHookAbi,
  poolSwapTestAbi,
  poolModifyLiquidityTestAbi,
  poolDonateTestAbi,
  addresses,
  alignDown,
  wash,
} from "@leadline/sdk";
import type { Charter } from "./useCharter";
import { demoPrivateKey, type DemoRole } from "./demo";
import { decodeRevert } from "./errors";

export type NoticeOutcome = "blocked" | "ran" | "error" | "live-only";

export type NoticeResult = {
  outcome: NoticeOutcome;
  message: string;
  before?: { below: bigint; above: bigint };
  after?: { below: bigint; above: bigint };
};

function clientFor(role: DemoRole) {
  return createWalletClient({
    account: privateKeyToAccount(demoPrivateKey(role)),
    chain: foundry,
    transport: http("http://127.0.0.1:8545"),
  });
}

function poolKeyOf(charter: Charter) {
  return {
    currency0: charter.key.currency0,
    currency1: charter.key.currency1,
    fee: charter.key.fee,
    tickSpacing: charter.key.tickSpacing,
    hooks: charter.key.hooks,
  };
}

/** Runs each Notices to Mariners card (§11.6) as a real transaction against the live chain. */
export function useNotices(charterId: bigint, charter: Charter | undefined, tick: number | undefined) {
  const [results, setResults] = useState<Record<number, NoticeResult>>({});
  const [running, setRunning] = useState<number | null>(null);
  const book = addresses[31337];
  const hook = book?.hook as `0x${string}` | undefined;

  async function expectRevert(num: number, send: () => Promise<unknown>) {
    setRunning(num);
    try {
      await send();
      setResults((r) => ({ ...r, [num]: { outcome: "error", message: "Expected a revert, but the call succeeded." } }));
    } catch (e) {
      const { message } = decodeRevert(e);
      setResults((r) => ({ ...r, [num]: { outcome: "blocked", message } }));
    } finally {
      setRunning(null);
    }
  }

  async function readDepth() {
    const client = createPublicClient({ chain: foundry, transport: http("http://127.0.0.1:8545") });
    const [below, above] = (await client.readContract({
      address: hook!,
      abi: leadlineHookAbi,
      functionName: "currentDepth",
      args: [charterId],
    })) as [bigint, bigint];
    return { below, above };
  }

  async function run(num: number) {
    if (!hook || !charter) return;

    if (num === 1) {
      // Withdraw the inventory to the market maker: recall() called by anyone but the issuer.
      return expectRevert(1, () =>
        clientFor("marketMaker").writeContract({ address: hook, abi: leadlineHookAbi, functionName: "recall", args: [charterId] })
      );
    }

    if (num === 2) {
      // Pull liquidity straight from the pool: the position is owned by (hook, salt), so an
      // attacker removing "their own" liquidity there is removing liquidity they never had.
      return expectRevert(2, () =>
        clientFor("anyone").writeContract({
          address: book.modifyLiquidityRouter as `0x${string}`,
          abi: poolModifyLiquidityTestAbi,
          functionName: "modifyLiquidity",
          args: [
            poolKeyOf(charter),
            { tickLower: charter.tickLower, tickUpper: charter.tickUpper, liquidityDelta: -1n, salt: `0x${charterId.toString(16).padStart(64, "0")}` },
            "0x",
          ],
        })
      );
    }

    if (num === 3) {
      // Steer the range far from the price: shift the whole range well clear of any
      // plausible current tick.
      return expectRevert(3, () =>
        clientFor("marketMaker").writeContract({
          address: hook,
          abi: leadlineHookAbi,
          functionName: "steer",
          args: [charterId, 400_000, 400_200],
        })
      );
    }

    if (num === 4) {
      // Steer a razor-thin range: must still contain the current price, just be too
      // narrow — otherwise it reverts on the wrong guard (RangeMustContainPrice).
      const lower = alignDown((tick ?? 0) - 10, charter.key.tickSpacing);
      return expectRevert(4, () =>
        clientFor("marketMaker").writeContract({
          address: hook,
          abi: leadlineHookAbi,
          functionName: "steer",
          args: [charterId, lower, lower + charter.key.tickSpacing],
        })
      );
    }

    if (num === 5) {
      // Call the hook's unlock callback directly, bypassing PoolManager.
      return expectRevert(5, () =>
        clientFor("anyone").writeContract({
          address: hook,
          abi: leadlineHookAbi,
          functionName: "unlockCallback",
          args: ["0x"],
        })
      );
    }

    if (num === 6) {
      // Wash-trade 100 swaps: fees should move, depth shouldn't.
      setRunning(6);
      try {
        const before = await readDepth();
        const client = clientFor("swapper");
        const key = poolKeyOf(charter);
        const steps = wash(50, Date.now() % 100000, 50n * 10n ** 15n);
        for (const step of steps) {
          await client.writeContract({
            address: book.swapRouter as `0x${string}`,
            abi: poolSwapTestAbi,
            functionName: "swap",
            args: [
              key,
              {
                zeroForOne: step.zeroForOne,
                amountSpecified: step.amountSpecified,
                sqrtPriceLimitX96: step.zeroForOne ? 4295128740n : 1461446703485210103287273052203988822378723720528n - 1n,
              },
              { takeClaims: false, settleUsingBurn: false },
              "0x",
            ],
          });
        }
        const after = await readDepth();
        setResults((r) => ({
          ...r,
          [6]: { outcome: "ran", message: "100 round-trip swaps ran. Depth barely moved — only fees did.", before, after },
        }));
      } catch (e) {
        setResults((r) => ({ ...r, [6]: { outcome: "error", message: decodeRevert(e).message } }));
      } finally {
        setRunning(null);
      }
      return;
    }

    if (num === 7) {
      // Donate to the range: always blocked.
      return expectRevert(7, () =>
        clientFor("anyone").writeContract({
          address: book.donateRouter as `0x${string}`,
          abi: poolDonateTestAbi,
          functionName: "donate",
          args: [poolKeyOf(charter), 1000n, 1000n, "0x"],
        })
      );
    }

    if (num === 8) {
      // Poke while the market maker is alive: only works once the heartbeat is stale.
      return expectRevert(8, () =>
        clientFor("anyone").writeContract({ address: hook, abi: leadlineHookAbi, functionName: "poke", args: [charterId] })
      );
    }

    if (num === 9) {
      // Settle the same epoch twice: the second call must run but change nothing.
      setRunning(9);
      try {
        const client = clientFor("anyone");
        await client.writeContract({ address: hook, abi: leadlineHookAbi, functionName: "settle", args: [charterId, 32n] });
        const before = await readDepth();
        await client.writeContract({ address: hook, abi: leadlineHookAbi, functionName: "settle", args: [charterId, 32n] });
        const after = await readDepth();
        setResults((r) => ({
          ...r,
          [9]: { outcome: "ran", message: "Settled twice. The second call closed nothing new — depth is unchanged.", before, after },
        }));
      } catch (e) {
        setResults((r) => ({ ...r, [9]: { outcome: "error", message: decodeRevert(e).message } }));
      } finally {
        setRunning(null);
      }
      return;
    }

    if (num === 10) {
      setResults((r) => ({
        ...r,
        [10]: {
          outcome: "live-only",
          message: "Needs a second pool deployed live, which this page can't do — see test_I2_SwapsInUnchartedPoolDoNotTouchCharterState in RedTeam.t.sol.",
        },
      }));
      return;
    }

    if (num === 11) {
      setResults((r) => ({
        ...r,
        [11]: {
          outcome: "live-only",
          message: "Needs a contract that reverts on receive, which this page can't deploy — see test_Recall_SucceedsEvenIfMarketMakerContractReverts in HandoverRecall.t.sol.",
        },
      }));
      return;
    }
  }

  return { run, results, running };
}
