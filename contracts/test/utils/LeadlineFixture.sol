// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {PoolDonateTest} from "@uniswap/v4-core/src/test/PoolDonateTest.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {HookMiner} from "@uniswap/v4-periphery/test/shared/HookMiner.sol";

import {LeadlineHook} from "../../src/LeadlineHook.sol";
import {ILeadline} from "../../src/interfaces/ILeadline.sol";
import {MockERC20} from "./MockERC20.sol";

contract LeadlineFixture is Test {
    using PoolIdLibrary for PoolKey;

    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    int24 internal constant TICK_SPACING = 60;

    // Core infrastructure
    IPoolManager public poolManager;
    LeadlineHook public hook;
    PoolSwapTest public swapRouter;
    PoolDonateTest public donateRouter;

    // Tokens (token0 / token1 are assigned by address sort order, see setUp)
    MockERC20 public token0;
    MockERC20 public token1;

    // Pool configuration
    PoolKey public poolKey;
    PoolId public poolId;

    // Accounts
    address public issuer;
    address public marketMaker;
    address public understudy;
    address public swapper;
    address public attacker;

    function setUp() public virtual {
        // Set up accounts
        issuer = makeAddr("issuer");
        marketMaker = makeAddr("marketMaker");
        understudy = makeAddr("understudy");
        swapper = makeAddr("swapper");
        attacker = makeAddr("attacker");

        // Deploy pool manager and a swap router for tests to drive swaps through
        poolManager = new PoolManager(address(this));
        swapRouter = new PoolSwapTest(poolManager);
        donateRouter = new PoolDonateTest(poolManager);

        // Deploy and sort tokens so token0 < token1 by address
        MockERC20 tide = new MockERC20("Tide", "TIDE", 18);
        MockERC20 usdc = new MockERC20("USDC", "USDC", 6);
        (token0, token1) = address(tide) < address(usdc) ? (tide, usdc) : (usdc, tide);

        // Mint tokens to accounts
        token0.mint(issuer, 1_000_000e18);
        token1.mint(issuer, 1_000_000e18);
        token0.mint(marketMaker, 100_000e18);
        token1.mint(marketMaker, 100_000e18);
        token0.mint(swapper, 100_000e18);
        token1.mint(swapper, 100_000e18);

        // Mine a hook address with the flags LeadlineHook declares
        uint160 flags = uint160(Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_DONATE_FLAG);
        bytes memory constructorArgs = abi.encode(poolManager);
        (address hookAddress, bytes32 salt) =
            HookMiner.find(address(this), flags, type(LeadlineHook).creationCode, constructorArgs);

        hook = new LeadlineHook{salt: salt}(poolManager);
        require(address(hook) == hookAddress, "LeadlineFixture: hook address mismatch");

        // Create and initialize the pool
        poolKey = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: 3000,
            tickSpacing: TICK_SPACING,
            hooks: hook
        });
        poolId = poolKey.toId();
        poolManager.initialize(poolKey, SQRT_PRICE_1_1);

        // Approvals for the swap router
        vm.startPrank(swapper);
        token0.approve(address(swapRouter), type(uint256).max);
        token1.approve(address(swapRouter), type(uint256).max);
        vm.stopPrank();

        // Approvals for the hook to pull charter inventory / retainer from the issuer
        vm.startPrank(issuer);
        token0.approve(address(hook), type(uint256).max);
        token1.approve(address(hook), type(uint256).max);
        vm.stopPrank();
    }

    /// @dev A reasonable default set of charter params centered on the pool's starting price (tick 0).
    function defaultCharterParams() internal view returns (ILeadline.CharterParams memory p) {
        p = ILeadline.CharterParams({
            key: poolKey,
            marketMaker: marketMaker,
            understudy: understudy,
            quoteIsCurrency1: true,
            amount0: 100e18,
            amount1: 100e18,
            tickLower: -600,
            tickUpper: 600,
            bandTicks: 100,
            minWidth: 120,
            maxWidth: 4000,
            fallbackHalfWidth: 1200,
            targetDepth: 1e18,
            uptimeBps: 8000,
            epochLength: 1 days,
            graceSeconds: 1 hours,
            numEpochs: 10,
            retainerToken: address(token1),
            retainerPerEpoch: 1000e18
        });
    }

    function createDefaultCharter() internal returns (uint256 id) {
        ILeadline.CharterParams memory p = defaultCharterParams();
        vm.prank(issuer);
        id = hook.createCharter(p);
    }

    function swap(bool zeroForOne, int256 amountSpecified) internal {
        vm.prank(swapper);
        swapRouter.swap(
            poolKey,
            SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: amountSpecified,
                sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
    }
}
