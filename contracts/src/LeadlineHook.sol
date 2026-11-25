// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@openzeppelin-hooks/base/BaseHook.sol";
import {CurrencySettler} from "@openzeppelin-hooks/utils/CurrencySettler.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ILeadline} from "./interfaces/ILeadline.sol";
import {DepthMath} from "./libraries/DepthMath.sol";
import {CharterLib} from "./libraries/CharterLib.sol";

/// @title LeadlineHook
/// @notice Uniswap v4 hook for token issuers to prove market-maker depth
contract LeadlineHook is BaseHook, IUnlockCallback, ILeadline {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;
    using CurrencySettler for Currency;
    using SafeERC20 for IERC20;

    // Reposition action used inside unlockCallback: remove the current position (if any)
    // then add a new one at [newTickLower, newTickUpper] using the charter's idle balances.
    // Recall-only removes; it never re-adds.
    enum Action {
        Create,
        Reposition,
        RemoveOnly
    }

    struct CallbackData {
        uint256 id;
        Action action;
        int24 newTickLower;
        int24 newTickUpper;
    }

    // State
    uint256 public nextId = 1;

    mapping(uint256 => Charter) public charters;
    mapping(PoolId => uint256) public charterOf; // 0 = none (ids start at 1)
    mapping(uint256 => mapping(uint32 => EpochResult)) public epochs;
    mapping(address => mapping(address => uint256)) public owed; // account => token => claimable

    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {}

    // ============ Hook permissions ============

    function getHookPermissions() public pure override returns (Hooks.Permissions memory p) {
        p.afterSwap = true;
        p.beforeDonate = true;
        // All other permissions default to false
    }

    // ============ Hook callbacks ============

    function _afterSwap(address, PoolKey calldata key, SwapParams calldata, BalanceDelta, bytes calldata)
        internal
        override
        returns (bytes4, int128)
    {
        uint256 id = charterOf[key.toId()];
        if (id != 0 && charters[id].status != Status.Recalled) {
            _accrue(id);
            _recache(id);
        }
        return (BaseHook.afterSwap.selector, 0);
    }

    function _beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        internal
        pure
        override
        returns (bytes4)
    {
        revert DonationsDisabled();
    }

    // ============ Unlock callback ============

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert UnauthorizedCallback();

        CallbackData memory cb = abi.decode(data, (CallbackData));
        Charter storage c = charters[cb.id];

        if (cb.action != Action.Create && c.liquidity > 0) {
            _removeLiquidity(cb.id);
        }

        if (cb.action != Action.RemoveOnly) {
            _addLiquidity(cb.id, cb.newTickLower, cb.newTickUpper);
        }

        return "";
    }

    /// @dev Removes the entire current position, routes the fee share straight to the
    /// issuer (swap fees always belong to the issuer) and keeps the principal as idle
    /// inventory the hook can redeploy.
    function _removeLiquidity(uint256 id) internal {
        Charter storage c = charters[id];

        (BalanceDelta callerDelta, BalanceDelta feesAccrued) = poolManager.modifyLiquidity(
            c.key,
            ModifyLiquidityParams({
                tickLower: c.tickLower,
                tickUpper: c.tickUpper,
                liquidityDelta: -int256(uint256(c.liquidity)),
                salt: bytes32(id)
            }),
            ""
        );

        uint256 total0 = uint256(int256(callerDelta.amount0()));
        uint256 total1 = uint256(int256(callerDelta.amount1()));
        uint256 fee0 = uint256(int256(feesAccrued.amount0()));
        uint256 fee1 = uint256(int256(feesAccrued.amount1()));

        c.key.currency0.take(poolManager, address(this), total0, false);
        c.key.currency1.take(poolManager, address(this), total1, false);

        c.fees0 += fee0;
        c.fees1 += fee1;
        c.idle0 += total0 - fee0;
        c.idle1 += total1 - fee1;
        c.liquidity = 0;

        owed[c.issuer][Currency.unwrap(c.key.currency0)] += fee0;
        owed[c.issuer][Currency.unwrap(c.key.currency1)] += fee1;
    }

    /// @dev Deploys the charter's idle inventory as a new position at [tickLower, tickUpper].
    function _addLiquidity(uint256 id, int24 tickLower, int24 tickUpper) internal {
        Charter storage c = charters[id];

        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(c.key.toId());
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(tickUpper);

        uint128 liquidity =
            LiquidityAmounts.getLiquidityForAmounts(sqrtPriceX96, sqrtLower, sqrtUpper, c.idle0, c.idle1);

        if (liquidity == 0) {
            c.tickLower = tickLower;
            c.tickUpper = tickUpper;
            return;
        }

        (BalanceDelta callerDelta,) = poolManager.modifyLiquidity(
            c.key,
            ModifyLiquidityParams({
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidityDelta: int256(uint256(liquidity)),
                salt: bytes32(id)
            }),
            ""
        );

        uint256 used0 = uint256(int256(-callerDelta.amount0()));
        uint256 used1 = uint256(int256(-callerDelta.amount1()));

        c.key.currency0.settle(poolManager, address(this), used0, false);
        c.key.currency1.settle(poolManager, address(this), used1, false);

        c.idle0 -= used0;
        c.idle1 -= used1;
        c.tickLower = tickLower;
        c.tickUpper = tickUpper;
        c.liquidity = liquidity;
    }

    // ============ Core charter operations ============

    function createCharter(CharterParams calldata p) external returns (uint256 id) {
        // Validate hook is correct
        if (p.key.hooks != this) {
            revert WrongHook();
        }

        // Check pool not already chartered
        PoolId poolId = p.key.toId();
        if (charterOf[poolId] != 0) {
            revert PoolAlreadyChartered();
        }

        // Validate parameters
        (, int24 currentTick,,) = poolManager.getSlot0(poolId);
        int24 tickSpacing = p.key.tickSpacing;
        CharterLib.validateParams(p, currentTick, tickSpacing);

        // Create charter
        id = nextId++;
        Charter storage c = charters[id];

        c.key = p.key;
        c.issuer = msg.sender;
        c.marketMaker = p.marketMaker;
        c.understudy = p.understudy;
        c.status = Status.Active;
        c.quoteIsCurrency1 = p.quoteIsCurrency1;
        c.tickLower = p.tickLower;
        c.tickUpper = p.tickUpper;
        c.bandTicks = p.bandTicks;
        c.minWidth = p.minWidth;
        c.maxWidth = p.maxWidth;
        c.fallbackHalfWidth = p.fallbackHalfWidth;
        c.targetDepth = p.targetDepth;
        c.uptimeBps = p.uptimeBps;
        c.epochLength = p.epochLength;
        c.graceSeconds = p.graceSeconds;
        c.retainerToken = p.retainerToken;
        c.retainerPerEpoch = p.retainerPerEpoch;
        c.retainerRemaining = p.retainerPerEpoch * p.numEpochs;
        c.termEnd = uint64(block.timestamp) + uint64(p.epochLength) * p.numEpochs;
        c.lastHeartbeat = uint64(block.timestamp);
        c.epochStart = uint64(block.timestamp);
        c.lastAccrual = uint64(block.timestamp);
        c.idle0 = p.amount0;
        c.idle1 = p.amount1;

        charterOf[poolId] = id;

        // Pull inventory and the full retainer escrow from the issuer up front.
        if (p.amount0 > 0) {
            IERC20(Currency.unwrap(p.key.currency0)).safeTransferFrom(msg.sender, address(this), p.amount0);
        }
        if (p.amount1 > 0) {
            IERC20(Currency.unwrap(p.key.currency1)).safeTransferFrom(msg.sender, address(this), p.amount1);
        }
        if (c.retainerRemaining > 0) {
            IERC20(p.retainerToken).safeTransferFrom(msg.sender, address(this), c.retainerRemaining);
        }

        poolManager.unlock(
            abi.encode(
                CallbackData({id: id, action: Action.Create, newTickLower: p.tickLower, newTickUpper: p.tickUpper})
            )
        );

        _recache(id);

        emit CharterCreated(
            id, poolId, msg.sender, p.marketMaker, p.understudy, c.tickLower, c.tickUpper, c.liquidity, p
        );

        return id;
    }

    function steer(uint256 id, int24 tickLower, int24 tickUpper) external {
        Charter storage c = charters[id];
        if (msg.sender != c.marketMaker) revert NotMarketMaker();
        if (c.status != Status.Active && c.status != Status.Fallback) {
            revert CharterNotActive();
        }

        int24 tickSpacing = c.key.tickSpacing;
        (, int24 currentTick,,) = poolManager.getSlot0(c.key.toId());
        CharterLib.validateSteer(c, tickLower, tickUpper, currentTick, tickSpacing);

        _accrue(id);

        poolManager.unlock(
            abi.encode(
                CallbackData({id: id, action: Action.Reposition, newTickLower: tickLower, newTickUpper: tickUpper})
            )
        );

        c.status = Status.Active;
        c.lastHeartbeat = uint64(block.timestamp);

        _recache(id);

        emit Steered(id, msg.sender, c.tickLower, c.tickUpper, c.liquidity);
    }

    function ping(uint256 id) external {
        Charter storage c = charters[id];
        if (msg.sender != c.marketMaker) revert NotMarketMaker();
        if (c.status != Status.Active) revert CharterNotActive();

        c.lastHeartbeat = uint64(block.timestamp);
        emit Pinged(id, msg.sender);
    }

    function poke(uint256 id) external {
        Charter storage c = charters[id];
        if (c.status != Status.Active) revert CharterNotActive();
        if (uint64(block.timestamp) <= c.lastHeartbeat + c.graceSeconds) {
            revert HeartbeatNotStale();
        }

        _accrue(id);

        (, int24 currentTick,,) = poolManager.getSlot0(c.key.toId());
        int24 bandLo = currentTick - c.fallbackHalfWidth;
        int24 bandHi = currentTick + c.fallbackHalfWidth;

        if (bandLo < TickMath.MIN_TICK) bandLo = TickMath.MIN_TICK;
        if (bandHi > TickMath.MAX_TICK) bandHi = TickMath.MAX_TICK;

        int24 tickSpacing = c.key.tickSpacing;
        bandLo -= bandLo % tickSpacing;
        bandHi -= bandHi % tickSpacing;

        poolManager.unlock(
            abi.encode(CallbackData({id: id, action: Action.Reposition, newTickLower: bandLo, newTickUpper: bandHi}))
        );

        c.status = Status.Fallback;

        _recache(id);

        emit Poked(id, msg.sender, c.tickLower, c.tickUpper, c.liquidity);
    }

    function setUnderstudy(uint256 id, address addr) external {
        Charter storage c = charters[id];
        if (msg.sender != c.issuer) revert NotIssuer();
        if (c.status == Status.Recalled) revert CharterNotActive();
        if (addr == c.marketMaker) revert ParamsOutOfBounds();

        c.understudy = addr;
        emit UnderstudySet(id, addr);
    }

    function handover(uint256 id) external {
        Charter storage c = charters[id];
        if (msg.sender != c.issuer) revert NotIssuer();
        if (c.understudy == address(0)) revert NoUnderstudy();

        _accrue(id);
        _closeEpoch(id, uint64(block.timestamp));

        address oldMM = c.marketMaker;
        c.marketMaker = c.understudy;
        c.understudy = address(0);
        c.lastHeartbeat = uint64(block.timestamp);

        _recache(id);

        emit HandedOver(id, oldMM, c.marketMaker);
    }

    function settle(uint256 id, uint256) external {
        _accrue(id);
    }

    function recall(uint256 id) external {
        Charter storage c = charters[id];
        if (msg.sender != c.issuer) revert NotIssuer();
        if (c.status == Status.Recalled) revert CharterNotActive();

        _accrue(id);
        _closeEpoch(id, uint64(block.timestamp));

        if (c.liquidity > 0) {
            poolManager.unlock(
                abi.encode(CallbackData({id: id, action: Action.RemoveOnly, newTickLower: 0, newTickUpper: 0}))
            );
        }

        c.status = Status.Recalled;

        uint256 out0 = c.idle0;
        uint256 out1 = c.idle1;
        c.idle0 = 0;
        c.idle1 = 0;

        if (out0 > 0) IERC20(Currency.unwrap(c.key.currency0)).safeTransfer(c.issuer, out0);
        if (out1 > 0) IERC20(Currency.unwrap(c.key.currency1)).safeTransfer(c.issuer, out1);
        if (c.retainerRemaining > 0) {
            uint256 remainder = c.retainerRemaining;
            c.retainerRemaining = 0;
            owed[c.issuer][c.retainerToken] += remainder;
        }

        emit Recalled(id, out0, out1, c.fees0, c.fees1);
    }

    function claim(address token) external {
        uint256 amount = owed[msg.sender][token];
        if (amount == 0) revert NothingToClaim();

        owed[msg.sender][token] = 0;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit Claimed(msg.sender, token, amount);
    }

    // ============ Internal functions ============

    function _accrue(uint256 id) internal {
        Charter storage c = charters[id];
        if (c.status == Status.Recalled) return;

        uint64 t = uint64(block.timestamp);
        if (t > c.termEnd) t = c.termEnd;

        uint256 iterations = 0;
        while (c.lastAccrual < t && iterations < CharterLib.MAX_EPOCHS_PER_ACCRUE) {
            uint64 epochEnd = c.epochStart + c.epochLength;
            uint64 segEnd = t < epochEnd ? t : epochEnd;
            uint64 dt = segEnd - c.lastAccrual;

            c.belowDepthSeconds += c.cachedBelow * dt;
            c.aboveDepthSeconds += c.cachedAbove * dt;

            if (c.cachedBelow >= c.targetDepth && c.cachedAbove >= c.targetDepth) {
                c.secondsInBand += dt;
            }

            c.lastAccrual = segEnd;

            if (segEnd == epochEnd) {
                _closeEpoch(id, epochEnd);
            }

            iterations++;
        }
    }

    function _closeEpoch(uint256 id, uint64 epochEnd) internal {
        Charter storage c = charters[id];

        (uint16 scoreBps, uint256 payout, uint256 refund) = CharterLib.scoreEpoch(c, epochEnd);

        epochs[id][c.epochIndex] = EpochResult({
            start: c.epochStart,
            end: epochEnd,
            marketMaker: c.marketMaker,
            belowDepthSeconds: c.belowDepthSeconds,
            aboveDepthSeconds: c.aboveDepthSeconds,
            secondsInBand: c.secondsInBand,
            scoreBps: scoreBps,
            payout: payout,
            refund: refund
        });

        owed[c.marketMaker][c.retainerToken] += payout;
        owed[c.issuer][c.retainerToken] += refund;
        c.retainerRemaining -= (payout + refund);

        emit EpochClosed(
            id,
            c.epochIndex,
            c.marketMaker,
            c.epochStart,
            epochEnd,
            c.belowDepthSeconds,
            c.aboveDepthSeconds,
            c.secondsInBand,
            scoreBps,
            payout,
            refund
        );

        c.belowDepthSeconds = 0;
        c.aboveDepthSeconds = 0;
        c.secondsInBand = 0;
        c.epochIndex++;
        c.epochStart = epochEnd;
    }

    function _recache(uint256 id) internal {
        Charter storage c = charters[id];
        (uint160 sqrtPriceX96, int24 tick,,) = poolManager.getSlot0(c.key.toId());

        (c.cachedBelow, c.cachedAbove) = DepthMath.depthInBand(
            sqrtPriceX96, tick, c.tickLower, c.tickUpper, c.liquidity, c.bandTicks, c.quoteIsCurrency1
        );

        bool inBand = c.cachedBelow >= c.targetDepth && c.cachedAbove >= c.targetDepth;
        emit DepthUpdated(id, c.cachedBelow, c.cachedAbove, inBand, tick, sqrtPriceX96);
    }

    // ============ View functions ============

    function getCharter(uint256 id) external view returns (Charter memory) {
        return charters[id];
    }

    function getEpoch(uint256 id, uint32 epoch) external view returns (EpochResult memory) {
        return epochs[id][epoch];
    }

    function currentDepth(uint256 id) external view returns (uint256 below, uint256 above) {
        Charter storage c = charters[id];
        return (c.cachedBelow, c.cachedAbove);
    }

    function currentTick(uint256 id) external view returns (int24 tick) {
        Charter storage c = charters[id];
        (, tick,,) = poolManager.getSlot0(c.key.toId());
    }

    function projectedScore(uint256 id) external view returns (uint16 scoreBps, uint256 projectedPayout) {
        Charter storage c = charters[id];
        if (c.status == Status.Recalled) return (0, 0);

        uint64 t = uint64(block.timestamp);
        uint64 epochEnd = c.epochStart + c.epochLength;
        if (t > epochEnd) t = epochEnd;
        uint64 dt = t > c.lastAccrual ? t - c.lastAccrual : 0;

        uint256 below = c.belowDepthSeconds + c.cachedBelow * dt;
        uint256 above = c.aboveDepthSeconds + c.cachedAbove * dt;
        uint64 inBand = c.secondsInBand + ((c.cachedBelow >= c.targetDepth && c.cachedAbove >= c.targetDepth) ? dt : 0);

        uint256 duration = t - c.epochStart;
        if (duration == 0 || c.targetDepth == 0) return (0, 0);

        uint256 belowScore = below * 10000 / (c.targetDepth * duration);
        if (belowScore > 10000) belowScore = 10000;
        uint256 aboveScore = above * 10000 / (c.targetDepth * duration);
        if (aboveScore > 10000) aboveScore = 10000;
        uint256 depthScore = belowScore < aboveScore ? belowScore : aboveScore;

        uint256 uptimeTarget = (c.uptimeBps * duration) / 10000;
        uint256 uptimeScore = uptimeTarget == 0 ? 0 : (inBand * 10000) / uptimeTarget;
        if (uptimeScore > 10000) uptimeScore = 10000;

        scoreBps = uint16(depthScore * uptimeScore / 10000);

        uint256 budget = c.retainerPerEpoch * duration / c.epochLength;
        if (budget > c.retainerRemaining) budget = c.retainerRemaining;
        projectedPayout = budget * scoreBps / 10000;
    }

    function owedOf(address account, address token) external view returns (uint256) {
        return owed[account][token];
    }
}
