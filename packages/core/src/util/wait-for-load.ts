/** Stop waiting on cancellation without cancelling or duplicating a shared model load. */
export function waitForLoad<T>(load: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return load;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(signal.reason);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    // Always observe settlement, even after cancellation, so a failed background load is handled.
    load.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
    if (signal.aborted) onAbort();
  });
}
