// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey, PoolId} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {PoolIdLibrary} from "@uniswap/v4-core/src/libraries/PoolIdLibrary.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {CurrencySettler} from "@uniswap/v4-core/src/libraries/CurrencySettler.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/lib/v4-core/src/libraries/LiquidityAmounts.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ILeadline} from "./interfaces/ILeadline.sol";
import {DepthMath} from "./libraries/DepthMath.sol";
import {CharterLib} from "./libraries/CharterLib.sol";

/// @title LeadlineHook
/// @notice Uniswap v4 hook for token issuers to prove market-maker depth
contract LeadlineHook is IUnlockCallback, ILeadline {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    IPoolManager public immutable poolManager;

    // State
    uint256 public nextId = 1;
    bool private _unlocking;

    mapping(uint256 => Charter) public charters;
    mapping(PoolId => uint256) public charterOf; // 0 = none (ids start at 1)
    mapping(uint256 => mapping(uint32 => EpochResult)) public epochs;
    mapping(address => mapping(address => uint256)) public owed; // account => token => claimable

    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
    }

    // ============ Hook permissions ============

    function getHookPermissions() public pure returns (Hooks.Permissions memory p) {
        p.afterSwap = true;
        p.beforeDonate = true;
        // All other permissions default to false
    }

    // ============ Hook callbacks ============

    function afterSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata,
        BalanceDelta,
        bytes calldata
    ) external override returns (bytes4, int128) {
        // Only called by PoolManager
        uint256 id = charterOf[key.toId()];
        if (id != 0 && charters[id].status != Status.Recalled) {
            _accrue(id);
            _recache(id);
        }
        return (this.afterSwap.selector, 0);
    }

    function beforeDonate(
        address,
        PoolKey calldata,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        revert DonationsDisabled();
    }

    // ============ Unlock callback ============

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager) || !_unlocking) {
            revert UnauthorizedCallback();
        }

        // Decode and execute liquidity modifications
        (uint256 id, ModifyOp[] memory ops) = abi.decode(data, (uint256, ModifyOp[]));

        // TODO: Process operations
        // For now, just complete the callback

        return "";
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
        int24 currentTick = poolManager.getSlot0(p.key).tick;
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

        charterOf[poolId] = id;

        // TODO: Pull tokens and add liquidity
        // For now, just emit event
        emit CharterCreated(
            id,
            poolId,
            msg.sender,
            p.marketMaker,
            p.understudy,
            p.tickLower,
            p.tickUpper,
            0, // liquidity (placeholder)
            p
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
        int24 currentTick = poolManager.getSlot0(c.key).tick;
        CharterLib.validateSteer(c, tickLower, tickUpper, currentTick, tickSpacing);

        // TODO: Remove all, add new, recache
        _accrue(id);

        c.tickLower = tickLower;
        c.tickUpper = tickUpper;
        c.status = Status.Active;
        c.lastHeartbeat = uint64(block.timestamp);

        _recache(id);

        emit Steered(id, msg.sender, tickLower, tickUpper, c.liquidity);
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

        // TODO: Move to fallback range
        _accrue(id);

        int24 currentTick = poolManager.getSlot0(c.key).tick;
        int24 bandLo = currentTick - c.fallbackHalfWidth;
        int24 bandHi = currentTick + c.fallbackHalfWidth;

        if (bandLo < TickMath.MIN_TICK) bandLo = TickMath.MIN_TICK;
        if (bandHi > TickMath.MAX_TICK) bandHi = TickMath.MAX_TICK;

        c.tickLower = bandLo;
        c.tickUpper = bandHi;
        c.status = Status.Fallback;

        _recache(id);

        emit Poked(id, msg.sender, bandLo, bandHi, c.liquidity);
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

    function settle(uint256 id, uint256 maxEpochs) external {
        _accrue(id);
    }

    function recall(uint256 id) external {
        Charter storage c = charters[id];
        if (msg.sender != c.issuer) revert NotIssuer();
        if (c.status == Status.Recalled) revert CharterNotActive();

        _accrue(id);
        _closeEpoch(id, uint64(block.timestamp));

        // TODO: Remove liquidity, transfer to issuer

        c.status = Status.Recalled;

        emit Recalled(id, c.idle0, c.idle1, c.fees0, c.fees1);
    }

    function claim(address token) external {
        uint256 amount = owed[msg.sender][token];
        if (amount == 0) revert NothingToClaim();

        owed[msg.sender][token] = 0;
        IERC20(token).transfer(msg.sender, amount);

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
        (uint160 sqrtPriceX96,) = poolManager.getSlot0(c.key);
        int24 tick = poolManager.getSlot0(c.key).tick;

        (c.cachedBelow, c.cachedAbove) = DepthMath.depthInBand(
            sqrtPriceX96,
            tick,
            c.tickLower,
            c.tickUpper,
            c.liquidity,
            c.bandTicks,
            c.quoteIsCurrency1
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

    function currentDepth(uint256 id)
        external
        view
        returns (uint256 below, uint256 above)
    {
        Charter storage c = charters[id];
        return (c.cachedBelow, c.cachedAbove);
    }

    function projectedScore(uint256 id)
        external
        view
        returns (uint16 scoreBps, uint256 projectedPayout)
    {
        // TODO: Calculate projected score based on current state
        return (0, 0);
    }

    function owedOf(address account, address token) external view returns (uint256) {
        return owed[account][token];
    }

    // Helper struct for unlock operations
    struct ModifyOp {
        uint8 op; // 0 = remove, 1 = add
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
    }
}
