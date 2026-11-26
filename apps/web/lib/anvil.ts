/** Local-only anvil JSON-RPC helpers for the demo drawer's fast-forward control. */
async function rpc(method: string, params: unknown[] = []) {
  await fetch("http://127.0.0.1:8545", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

/** Advances anvil's clock by `seconds` and mines one block, so epochs/heartbeats resolve instantly. */
export async function fastForward(seconds: number) {
  await rpc("evm_increaseTime", [seconds]);
  await rpc("evm_mine", []);
}
