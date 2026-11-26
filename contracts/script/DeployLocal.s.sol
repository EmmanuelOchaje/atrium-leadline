// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PoolDonateTest} from "@uniswap/v4-core/src/test/PoolDonateTest.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {HookMiner} from "@uniswap/v4-periphery/test/shared/HookMiner.sol";

import {LeadlineHook} from "../src/LeadlineHook.sol";
import {ILeadline} from "../src/interfaces/ILeadline.sol";
import {MockERC20} from "../test/utils/MockERC20.sol";

/// @notice Anvil local deployment: PoolManager, routers, demo tokens, the mined hook, an
/// initialised TIDE/USDC pool with outside liquidity, and charter #1 with demo params.
/// Writes `packages/sdk/src/addresses.ts` so nothing is ever pasted by hand.
contract DeployLocal is Script {
    using PoolIdLibrary for PoolKey;

    // CREATE2 deployer proxy that Foundry routes salted deploys through in `forge script`.
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    int24 constant TICK_SPACING = 60;

    function run() external {
        // Anvil's well-known default accounts (#0-#3). Never reuse these anywhere real.
        uint256 deployerKey =
            vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerKey);

        address issuer = deployer;
        address marketMaker = vm.addr(
            vm.envOr("MM_PRIVATE_KEY", uint256(0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690))
        );
        address understudy = vm.addr(
            vm.envOr(
                "UNDERSTUDY_PRIVATE_KEY", uint256(0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365)
            )
        );
        address swapper = vm.addr(
            vm.envOr("SWAPPER_PRIVATE_KEY", uint256(0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007))
        );
        // "Anyone" in the web Console's role switcher: anvil's account #4, which has no role
        // in the charter, for exercising the permissionless poke/settle/claim paths.
        address anyone = vm.addr(
            vm.envOr("ANYONE_PRIVATE_KEY", uint256(0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926))
        );

        vm.startBroadcast(deployerKey);

        // None of these demo keys are anvil's own funded dev accounts (only `issuer` is), so
        // without this every non-issuer role switcher action fails on gas, not on logic.
        _fundWithEth(marketMaker, 10 ether);
        _fundWithEth(understudy, 10 ether);
        _fundWithEth(swapper, 10 ether);
        _fundWithEth(anyone, 10 ether);

        PoolManager poolManager = new PoolManager(deployer);
        PoolSwapTest swapRouter = new PoolSwapTest(poolManager);
        PoolModifyLiquidityTest modifyLiquidityRouter = new PoolModifyLiquidityTest(poolManager);
        PoolDonateTest donateRouter = new PoolDonateTest(poolManager);

        MockERC20 tide = new MockERC20("Tide", "TIDE", 18);
        MockERC20 usdc = new MockERC20("USDC", "USDC", 6);
        (MockERC20 token0, MockERC20 token1) = address(tide) < address(usdc) ? (tide, usdc) : (usdc, tide);

        uint160 flags = uint160(Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_DONATE_FLAG);
        bytes memory constructorArgs = abi.encode(poolManager);
        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, flags, type(LeadlineHook).creationCode, constructorArgs);
        LeadlineHook hook = new LeadlineHook{salt: salt}(poolManager);
        require(address(hook) == hookAddress, "DeployLocal: hook address mismatch");

        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: 3000,
            tickSpacing: TICK_SPACING,
            hooks: hook
        });
        poolManager.initialize(poolKey, SQRT_PRICE_1_1);

        // Outside liquidity so swaps work beyond the charter's own band.
        token0.mint(deployer, 1_000_000e18);
        token1.mint(deployer, 1_000_000e18);
        token0.approve(address(modifyLiquidityRouter), type(uint256).max);
        token1.approve(address(modifyLiquidityRouter), type(uint256).max);
        modifyLiquidityRouter.modifyLiquidity(
            poolKey,
            ModifyLiquidityParams({tickLower: -6000, tickUpper: 6000, liquidityDelta: 50_000e18, salt: bytes32(0)}),
            ""
        );

        // Fund demo accounts for the bots and the Console.
        token0.mint(swapper, 100_000e18);
        token1.mint(swapper, 100_000e18);
        token0.mint(issuer, 1_000_000e18);
        token1.mint(issuer, 1_000_000e18);

        token0.approve(address(hook), type(uint256).max);
        token1.approve(address(hook), type(uint256).max);

        // Decimals (and so which of token0/token1 is USDC) depend on deploy-time address
        // sort order, not on mint order — read them back instead of assuming.
        bool usdcIsToken0 = token0.decimals() == 6;
        // Deposited a few % over the 25,000 target per side so the charter opens cleanly
        // in band: DepthMath rounds down conservatively, so sizing this to exactly the
        // target leaves it 1 wei short — in band on paper, out of band on-chain.
        uint256 amount0 = usdcIsToken0 ? 26_250e6 : 1_050e18;
        uint256 amount1 = usdcIsToken0 ? 1_050e18 : 26_250e6;
        // DepthMath always expresses depth/target in the *quote* token's own decimals.
        // Quote = USDC, so target depth and retainer are both in USDC's 6 decimals.
        ILeadline.CharterParams memory params = ILeadline.CharterParams({
            key: poolKey,
            marketMaker: marketMaker,
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
        uint256 charterId = hook.createCharter(params);
        uint256 deployBlock = block.number;

        vm.stopBroadcast();

        console2.log("PoolManager:", address(poolManager));
        console2.log("LeadlineHook:", address(hook));
        console2.log("TIDE (token0?):", address(tide));
        console2.log("USDC:", address(usdc));
        console2.log("Charter #1 id:", charterId);

        _writeAddressBook(
            address(poolManager),
            address(hook),
            address(swapRouter),
            address(modifyLiquidityRouter),
            address(donateRouter),
            address(token0),
            address(token1),
            poolKey,
            charterId,
            deployBlock
        );
    }

    function _fundWithEth(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        require(ok, "DeployLocal: ETH funding failed");
    }

    function _writeAddressBook(
        address poolManager,
        address hook,
        address swapRouter,
        address modifyLiquidityRouter,
        address donateRouter,
        address token0,
        address token1,
        PoolKey memory poolKey,
        uint256 charterId,
        uint256 deployBlock
    ) internal {
        string memory json = string.concat(
            "{\n",
            '  "poolManager": "',
            vm.toString(poolManager),
            '",\n',
            '  "hook": "',
            vm.toString(hook),
            '",\n',
            '  "swapRouter": "',
            vm.toString(swapRouter),
            '",\n',
            '  "modifyLiquidityRouter": "',
            vm.toString(modifyLiquidityRouter),
            '",\n',
            '  "donateRouter": "',
            vm.toString(donateRouter),
            '",\n',
            '  "token0": "',
            vm.toString(token0),
            '",\n',
            '  "token1": "',
            vm.toString(token1),
            '",\n',
            '  "poolFee": ',
            vm.toString(uint256(poolKey.fee)),
            ",\n",
            '  "tickSpacing": ',
            vm.toString(int256(poolKey.tickSpacing)),
            ",\n",
            '  "poolId": "',
            vm.toString(PoolId.unwrap(poolKey.toId())),
            '",\n',
            '  "charterId": ',
            vm.toString(charterId),
            ",\n",
            '  "deployBlock": ',
            vm.toString(deployBlock),
            "\n}\n"
        );

        string memory ts = string.concat(
            "// Generated by script/DeployLocal.s.sol - do not edit by hand.\n",
            "export const addresses = {\n",
            "  31337: ",
            json,
            "} as const;\n"
        );

        vm.writeFile("../packages/sdk/src/addresses.ts", ts);
        console2.log("Wrote packages/sdk/src/addresses.ts");
    }
}
