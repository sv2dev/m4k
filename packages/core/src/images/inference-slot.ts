/** At most 64 MiB of bounded preview snapshots may wait behind active inference. */
export const maxInferenceWaiters = 8;
let busy = false;
const waiting: (() => void)[] = [];

/** Reserve synchronously before callers copy their input; wait in FIFO order or reject admission. */
export function acquireInferenceSlot(wait: boolean, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  if (!busy) {
    busy = true;
    return Promise.resolve();
  }
  if (!wait) throw new Error("Classifier is busy");
  if (waiting.length >= maxInferenceWaiters) throw new Error("Classifier wait queue is full");
  return new Promise<void>((resolve, reject) => {
    const turn = () => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    };
    const onAbort = () => {
      const index = waiting.indexOf(turn);
      if (index >= 0) waiting.splice(index, 1);
      reject(signal!.reason);
    };
    waiting.push(turn);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Transfer ownership to the next admitted waiter, or mark inference idle. */
export function releaseInferenceSlot() {
  const next = waiting.shift();
  if (next) next();
  else busy = false;
}
