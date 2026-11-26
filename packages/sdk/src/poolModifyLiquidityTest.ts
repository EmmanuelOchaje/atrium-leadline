/** Minimal ABI for v4-core's `PoolModifyLiquidityTest` router — enough for the red-team demo. */
export const poolModifyLiquidityTestAbi = [
  {
    type: "function",
    name: "modifyLiquidity",
    stateMutability: "payable",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tickLower", type: "int24" },
          { name: "tickUpper", type: "int24" },
          { name: "liquidityDelta", type: "int256" },
          { name: "salt", type: "bytes32" },
        ],
      },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [{ name: "delta", type: "int256" }],
  },
] as const;

/** Minimal ABI for v4-core's `PoolDonateTest` router. */
export const poolDonateTestAbi = [
  {
    type: "function",
    name: "donate",
    stateMutability: "payable",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [{ name: "delta", type: "int256" }],
  },
] as const;
