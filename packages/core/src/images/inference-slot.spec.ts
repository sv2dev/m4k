import { describe, expect, test } from "bun:test";
import {
  acquireInferenceSlot,
  maxInferenceWaiters,
  releaseInferenceSlot,
} from "./inference-slot.js";

describe("inference slot admission", () => {
  test("bounds waiters, rejects overflow synchronously and drains admitted callers in order", async () => {
    await acquireInferenceSlot(false);
    const order: number[] = [];
    const admitted = Array.from({ length: maxInferenceWaiters }, (_, i) =>
      acquireInferenceSlot(true).then(() => {
        order.push(i);
      }),
    );
    let overflow: unknown;

    try {
      acquireInferenceSlot(true);
    } catch (error) {
      overflow = error;
    }
    releaseInferenceSlot();
    for (const pending of admitted) {
      await pending;
      releaseInferenceSlot();
    }
    await acquireInferenceSlot(false);
    releaseInferenceSlot();

    expect(String(overflow)).toContain("wait queue is full");
    expect(order).toEqual(Array.from({ length: maxInferenceWaiters }, (_, i) => i));
  });

  test("cancelled waiters free capacity without stealing or releasing active inference", async () => {
    await acquireInferenceSlot(false);
    const controller = new AbortController();
    const cancelled = acquireInferenceSlot(true, controller.signal).then(
      () => "unexpected",
      (error: Error) => error.name,
    );
    const admitted = Array.from({ length: maxInferenceWaiters - 1 }, () =>
      acquireInferenceSlot(true),
    );
    let busy: unknown;

    controller.abort();
    const replacement = acquireInferenceSlot(true);
    try {
      acquireInferenceSlot(false);
    } catch (error) {
      busy = error;
    }
    const aborted = await cancelled;
    releaseInferenceSlot();
    for (const pending of [...admitted, replacement]) {
      await pending;
      releaseInferenceSlot();
    }
    await acquireInferenceSlot(false);
    releaseInferenceSlot();

    expect(aborted).toBe("AbortError");
    expect(String(busy)).toContain("Classifier is busy");
  });

  test("rejects an already aborted request without acquiring the idle slot", async () => {
    const controller = new AbortController();
    controller.abort();
    let rejected: unknown;

    try {
      acquireInferenceSlot(true, controller.signal);
    } catch (error) {
      rejected = error;
    }
    await acquireInferenceSlot(false);
    releaseInferenceSlot();

    expect(rejected).toBeInstanceOf(DOMException);
  });
});
