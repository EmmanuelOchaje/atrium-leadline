// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";

interface ILeadline {
    // Status enum
    enum Status {
        None,
        Active,
        Fallback,
        Recalled
    }

    // Charter creation parameters
    struct CharterParams {
        PoolKey key;
        address marketMaker;
        address understudy;
        bool quoteIsCurrency1;
        uint256 amount0;
        uint256 amount1;
        int24 tickLower;
        int24 tickUpper;
        int24 bandTicks;
        int24 minWidth;
        int24 maxWidth;
        int24 fallbackHalfWidth;
        uint256 targetDepth;
        uint16 uptimeBps;
        uint32 epochLength;
        uint32 graceSeconds;
        uint32 numEpochs;
        address retainerToken;
        uint256 retainerPerEpoch;
    }

    // Charter stored state
    struct Charter {
        PoolKey key;
        address issuer;
        address marketMaker;
        address understudy;
        Status status;
        bool quoteIsCurrency1;
        // position
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        // balances held by the hook
        uint256 idle0;
        uint256 idle1;
        uint256 fees0;
        uint256 fees1;
        // terms
        int24 bandTicks;
        int24 minWidth;
        int24 maxWidth;
        int24 fallbackHalfWidth;
        uint256 targetDepth;
        uint16 uptimeBps;
        uint32 epochLength;
        uint32 graceSeconds;
        address retainerToken;
        uint256 retainerPerEpoch;
        uint256 retainerRemaining;
        uint64 termEnd;
        // liveness
        uint64 lastHeartbeat;
        // current epoch accumulators
        uint32 epochIndex;
        uint64 epochStart;
        uint64 lastAccrual;
        uint256 belowDepthSeconds;
        uint256 aboveDepthSeconds;
        uint64 secondsInBand;
        uint256 cachedBelow;
        uint256 cachedAbove;
    }

    // Closed epoch result
    struct EpochResult {
        uint64 start;
        uint64 end;
        address marketMaker;
        uint256 belowDepthSeconds;
        uint256 aboveDepthSeconds;
        uint64 secondsInBand;
        uint16 scoreBps;
        uint256 payout;
        uint256 refund;
    }

    // Events
    event CharterCreated(
        uint256 indexed id,
        PoolId indexed poolId,
        address indexed issuer,
        address marketMaker,
        address understudy,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        CharterParams params
    );

    event Steered(uint256 indexed id, address indexed marketMaker, int24 tickLower, int24 tickUpper, uint128 liquidity);

    event Pinged(uint256 indexed id, address indexed marketMaker);

    event Poked(uint256 indexed id, address indexed poker, int24 tickLower, int24 tickUpper, uint128 liquidity);

    event UnderstudySet(uint256 indexed id, address indexed understudy);

    event HandedOver(uint256 indexed id, address indexed from, address indexed to);

    event DepthUpdated(uint256 indexed id, uint256 below, uint256 above, bool inBand, int24 tick, uint160 sqrtPriceX96);

    event EpochClosed(
        uint256 indexed id,
        uint32 indexed epoch,
        address indexed marketMaker,
        uint64 start,
        uint64 end,
        uint256 belowDepthSeconds,
        uint256 aboveDepthSeconds,
        uint64 secondsInBand,
        uint16 scoreBps,
        uint256 payout,
        uint256 refund
    );

    event Recalled(uint256 indexed id, uint256 amount0, uint256 amount1, uint256 fees0, uint256 fees1);

    event Claimed(address indexed account, address indexed token, uint256 amount);

    // Errors
    error NotIssuer();
    error NotMarketMaker();
    error WrongHook();
    error PoolAlreadyChartered();
    error UnauthorizedCallback();
    error RangeMustContainPrice();
    error RangeWidthOutOfBounds();
    error RangeNotAligned();
    error ParamsOutOfBounds();
    error DonationsDisabled();
    error HeartbeatNotStale();
    error NoUnderstudy();
    error CharterNotActive();
    error TermEnded();
    error NothingToClaim();

    // Functions (§5.3)
    function createCharter(CharterParams calldata p) external returns (uint256 id);

    function steer(uint256 id, int24 tickLower, int24 tickUpper) external;

    function ping(uint256 id) external;

    function poke(uint256 id) external;

    function setUnderstudy(uint256 id, address addr) external;

    function handover(uint256 id) external;

    function settle(uint256 id, uint256 maxEpochs) external;

    function recall(uint256 id) external;

    function claim(address token) external;

    // Views
    function getCharter(uint256 id) external view returns (Charter memory);

    function getEpoch(uint256 id, uint32 epoch) external view returns (EpochResult memory);

    function currentDepth(uint256 id) external view returns (uint256 below, uint256 above);

    function projectedScore(uint256 id) external view returns (uint16 scoreBps, uint256 projectedPayout);

    function owedOf(address account, address token) external view returns (uint256);
}
