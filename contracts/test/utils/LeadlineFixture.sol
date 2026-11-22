// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

import {LeadlineHook} from "../../src/LeadlineHook.sol";
import {ILeadline} from "../../src/interfaces/ILeadline.sol";
import {MockERC20} from "./MockERC20.sol";

contract LeadlineFixture is Test {
    using PoolIdLibrary for PoolKey;

    // Core infrastructure
    IPoolManager public poolManager;
    LeadlineHook public hook;

    // Tokens
    MockERC20 public tide; // token0: 18 decimals
    MockERC20 public usdc; // token1: 6 decimals

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
        issuer = address(0x1111);
        marketMaker = address(0x2222);
        understudy = address(0x3333);
        swapper = address(0x4444);
        attacker = address(0x5555);

        // Deploy tokens
        tide = new MockERC20("Tide", "TIDE", 18);
        usdc = new MockERC20("USDC", "USDC", 6);

        // Mint tokens to accounts
        tide.mint(issuer, 1000e18);
        tide.mint(marketMaker, 100e18);
        tide.mint(swapper, 100e18);
        usdc.mint(issuer, 100000e6);
        usdc.mint(marketMaker, 10000e6);
        usdc.mint(swapper, 10000e6);

        // TODO: Deploy PoolManager and hook
        // This requires v4-core setup which will be detailed in next iteration

        // Create pool key
        // poolKey = PoolKey({
        //     currency0: Currency.wrap(address(tide)),
        //     currency1: Currency.wrap(address(usdc)),
        //     fee: 3000, // 0.3%
        //     tickSpacing: 10,
        //     hooks: hook
        // });
        // poolId = poolKey.toId();

        // TODO: Initialize pool at a sane price
    }
}
