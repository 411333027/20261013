// 「每 N 秒最多幾則」的限制。

export const SEND_LIMIT = { limit: 5, windowMs: 10_000 }; // 自己送：10 秒 5 則
export const RECEIVE_LIMIT = { limit: 10, windowMs: 10_000 }; // 收別人的：同一人 10 秒超過 10 則就丟掉

export function createRateLimiter({ limit, windowMs }, now = () => Date.now()) {
  let stamps = [];

  function prune() {
    const cutoff = now() - windowMs;
    stamps = stamps.filter((t) => t > cutoff);
  }

  return {
    /** 現在還能不能再送一則；不能的話，retryInMs 是還要等多久。 */
    check() {
      prune();
      if (stamps.length < limit) return { ok: true, retryInMs: 0 };
      return { ok: false, retryInMs: stamps[0] + windowMs - now() };
    },
    record() {
      stamps.push(now());
    },
  };
}

/** 收訊息時，依身分編號分別計算，過濾洗版的人。 */
export function createSenderFilter(options = RECEIVE_LIMIT, now = () => Date.now()) {
  const limiters = new Map();
  return {
    allow(senderId) {
      let limiter = limiters.get(senderId);
      if (!limiter) {
        limiter = createRateLimiter(options, now);
        limiters.set(senderId, limiter);
      }
      if (!limiter.check().ok) return false;
      limiter.record();
      return true;
    },
  };
}
