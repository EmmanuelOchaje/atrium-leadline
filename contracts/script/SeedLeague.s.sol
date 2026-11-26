// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {LeadlineHook} from "../src/LeadlineHook.sol";
import {ILeadline} from "../src/interfaces/ILeadline.sol";
import {MockERC20} from "../test/utils/MockERC20.sol";

/// @notice Seeds the Proving Ground with history: 3 more pools and charters, on the same
/// hook `DeployLocal.s.sol` already deployed, run by three fictional market makers with
/// different delivery records (good, mediocre with one missed heartbeat, poor). Run after
/// DeployLocal; reads its addresses from `script/addresses.local.json`.
///
/// forge script script/SeedLeague.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --slow -g 400
///
/// `-g 400` (gas-estimate-multiplier) and `--slow` matter: several of this script's
/// transactions are swaps/settles right after a `vm.warp`, and forge's default gas
/// estimate against anvil undershoots badly for them, failing with a bare `OutOfGas`.
contract SeedLeague is Script {
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    int24 constant TICK_SPACING = 60;

    function run() external {
        uint256 deployerKey =
            vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerKey);

        string memory addrJson = vm.readFile("script/addresses.local.json");
        IPoolManager poolManager = IPoolManager(vm.parseJsonAddress(addrJson, ".poolManager"));
        LeadlineHook hook = LeadlineHook(vm.parseJsonAddress(addrJson, ".hook"));

        // Fictional market makers (§8): distinct keys, never anvil's funded dev accounts.
        _seedCharter(
            poolManager,
            hook,
            deployer,
            deployerKey,
            "Saltmarsh",
            0x1111111111111111111111111111111111111111111111111111111111111a,
            true,
            false
        );
        _seedCharter(
            poolManager,
            hook,
            deployer,
            deployerKey,
            "Northline",
            0x2222222222222222222222222222222222222222222222222222222222222b,
            true,
            true
        );
        _seedCharter(
            poolManager,
            hook,
            deployer,
            deployerKey,
            "Brightwater",
            0x3333333333333333333333333333333333333333333333333333333333331c,
            false,
            false
        );

        console2.log("Seeded 3 charters for the Proving Ground.");
    }

    /// @param goodDelivery whether the market maker steers to stay in band (true) or never
    ///   touches the range after creation (false) — the two shapes of a delivery record.
    /// @param missHeartbeat whether to also let the heartbeat go stale once and get poked,
    ///   the "handed over" reputation hit the league tracks.
    function _seedCharter(
        IPoolManager poolManager,
        LeadlineHook hook,
        address deployer,
        uint256 deployerKey,
        string memory label,
        uint256 mmKeySeed,
        bool goodDelivery,
        bool missHeartbeat
    ) internal {
        uint256 mmKey = mmKeySeed;
        address mm = vm.addr(mmKey);
        address understudy = vm.addr(mmKey + 1);

        vm.startBroadcast(deployerKey);
        (bool ok,) = mm.call{value: 1 ether}("");
        require(ok, "SeedLeague: funding failed");

        MockERC20 tokenA = new MockERC20(string.concat(label, "Base"), "BASE", 18);
        MockERC20 tokenB = new MockERC20("USDC", "USDC", 6);
        (MockERC20 token0, MockERC20 token1) = address(tokenA) < address(tokenB) ? (tokenA, tokenB) : (tokenB, tokenA);
        bool usdcIsToken0 = token0.decimals() == 6;

        PoolSwapTest swapRouter = new PoolSwapTest(poolManager);
        PoolModifyLiquidityTest modifyLiquidityRouter = new PoolModifyLiquidityTest(poolManager);

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: 3000,
            tickSpacing: TICK_SPACING,
            hooks: hook
        });
        poolManager.initialize(key, SQRT_PRICE_1_1);

        token0.mint(deployer, 1_000_000e18);
        token1.mint(deployer, 1_000_000e18);
        token0.approve(address(modifyLiquidityRouter), type(uint256).max);
        token1.approve(address(modifyLiquidityRouter), type(uint256).max);
        modifyLiquidityRouter.modifyLiquidity(
            key,
            ModifyLiquidityParams({tickLower: -6000, tickUpper: 6000, liquidityDelta: 50_000e18, salt: bytes32(0)}),
            ""
        );
        token0.approve(address(swapRouter), type(uint256).max);
        token1.approve(address(swapRouter), type(uint256).max);

        token0.approve(address(hook), type(uint256).max);
        token1.approve(address(hook), type(uint256).max);

        uint256 amount0 = usdcIsToken0 ? 26_250e6 : 1_050e18;
        uint256 amount1 = usdcIsToken0 ? 1_050e18 : 26_250e6;

        ILeadline.CharterParams memory params = ILeadline.CharterParams({
            key: key,
            marketMaker: mm,
            understudy: understudy,
            quoteIsCurrency1: !usdcIsToken0,
            amount0: amount0,
            amount1: amount1,
            tickLower: -180,
            tickUpper: 180,
            bandTicks: 200,
            minWidth: 120,
            maxWidth: 4000,
            fallbackHalfWidth: 1200,
            targetDepth: 25_000e6,
            uptimeBps: 9000,
            epochLength: 120,
            graceSeconds: 45,
            numEpochs: 30,
            retainerToken: usdcIsToken0 ? address(token0) : address(token1),
            retainerPerEpoch: 500e6
        });
        uint256 id = hook.createCharter(params);
        vm.stopBroadcast();

        // A few swaps to move price within the band, so depth isn't static.
        vm.startBroadcast(deployerKey);
        swapRouter.swap(
            key,
            SwapParams({zeroForOne: true, amountSpecified: -1e17, sqrtPriceLimitX96: 4295128740}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
        vm.stopBroadcast();

        if (goodDelivery) {
            // Re-steer to the same range each epoch — an ordinary, attentive heartbeat.
            for (uint256 i = 0; i < 2; i++) {
                vm.warp(block.timestamp + 110);
                vm.startBroadcast(mmKey);
                hook.steer(id, -180, 180);
                vm.stopBroadcast();
            }
        } else if (missHeartbeat) {
            // One epoch delivered, then the heartbeat goes stale and gets poked —
            // the "handed over" reputation hit the league tracks.
            vm.warp(block.timestamp + 110);
            vm.startBroadcast(mmKey);
            hook.steer(id, -180, 180);
            vm.stopBroadcast();

            vm.warp(block.timestamp + 50);
            vm.startBroadcast(deployerKey);
            hook.poke(id);
            vm.stopBroadcast();
        }
        // else: never steers again after creation — the "went dark from day one" record.

        vm.warp(block.timestamp + 250);
        vm.startBroadcast(deployerKey);
        hook.settle(id, 32);
        vm.stopBroadcast();

        console2.log(string.concat(label, " charter id:"), id);
    }
}
