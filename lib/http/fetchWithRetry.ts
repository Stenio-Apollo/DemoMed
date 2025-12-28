export type FetchWithRetryOptions = {
    retries?: number;         // default 5
    baseDelayMs?: number;     // default 400
    maxDelayMs?: number;      // default 5000
    retryOnStatuses?: number[]; // default [429, 500, 502, 503, 504]
};

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function jitter(ms: number) {
    // +- 25% jitter
    const j = ms * 0.25 * (Math.random() * 2 - 1);
    return Math.max(0, Math.round(ms + j));
}

export async function fetchWithRetry(
    input: RequestInfo | URL,
    init?: RequestInit,
    opts: FetchWithRetryOptions = {}
) {
    const {
        retries = 5,
        baseDelayMs = 400,
        maxDelayMs = 5000,
        retryOnStatuses = [429, 500, 502, 503, 504],
    } = opts;

    let attempt = 0;

    while (true) {
        attempt++;

        try {
            const res = await fetch(input, init);

            if (!retryOnStatuses.includes(res.status) || attempt > retries) {
                return res;
            }

            // If rate limited, try to respect Retry-After
            const retryAfter = res.headers.get("retry-after");
            const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : null;

            const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
            const delay = retryAfterMs ?? jitter(backoff);

            await sleep(delay);
            continue;
        } catch (err) {
            if (attempt > retries) throw err;
            const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
            await sleep(jitter(backoff));
        }
    }
}
