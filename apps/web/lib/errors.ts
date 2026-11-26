/** Maps a custom error name to the invariant it enforces, for plain-language revert messages (§11.5, §11.6). */
export const INVARIANT_BY_ERROR: Record<string, string> = {
  NotIssuer: "I1 Custody",
  NotMarketMaker: "I1 Custody",
  WrongHook: "I2 Pool binding",
  PoolAlreadyChartered: "I2 Pool binding",
  UnauthorizedCallback: "I3 Caller auth",
  RangeMustContainPrice: "I4 Bounded steering",
  RangeWidthOutOfBounds: "I4 Bounded steering",
  RangeNotAligned: "I4 Bounded steering",
  ParamsOutOfBounds: "I4 Bounded steering",
  DonationsDisabled: "I7 Honest measurement",
  HeartbeatNotStale: "I9 Liveness",
  NoUnderstudy: "I9 Liveness",
  CharterNotActive: "Charter lifecycle",
  TermEnded: "Charter lifecycle",
  NothingToClaim: "Pull payments",
};

const SENTENCE_BY_ERROR: Record<string, string> = {
  NotIssuer: "Only the issuer can do that.",
  NotMarketMaker: "Only the market maker can do that.",
  WrongHook: "That pool isn't using this hook.",
  PoolAlreadyChartered: "This pool already has a charter.",
  UnauthorizedCallback: "That callback only runs inside the pool manager's own unlock.",
  RangeMustContainPrice: "The new range must contain the current price.",
  RangeWidthOutOfBounds: "The range width is outside the charter's bounds.",
  RangeNotAligned: "The range isn't aligned to the pool's tick spacing.",
  ParamsOutOfBounds: "One of the charter's parameters is outside the global caps.",
  DonationsDisabled: "Donations are always blocked on a chartered pool.",
  HeartbeatNotStale: "The market maker's heartbeat isn't stale yet.",
  NoUnderstudy: "No understudy is set for this charter.",
  CharterNotActive: "This charter isn't active.",
  TermEnded: "This charter's term has ended.",
  NothingToClaim: "This account has nothing owed to claim.",
};

/** Pulls a known Leadline error name out of whatever shape viem threw it in. */
export function decodeRevert(error: unknown): { name: string | null; message: string } {
  const text = errorText(error);
  for (const name of Object.keys(SENTENCE_BY_ERROR)) {
    if (text.includes(name)) {
      const invariant = INVARIANT_BY_ERROR[name];
      return { name, message: `${SENTENCE_BY_ERROR[name]} (${invariant})` };
    }
  }
  return { name: null, message: text.split("\n")[0] ?? "Reverted." };
}

function errorText(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) {
    const shortMessage = (error as { shortMessage?: string }).shortMessage;
    const cause = (error as { cause?: unknown }).cause;
    return [shortMessage, error.message, cause ? errorText(cause) : ""].filter(Boolean).join(" ");
  }
  return String(error);
}
