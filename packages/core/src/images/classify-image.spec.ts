import { describe, expect, test } from "bun:test";
import { runClassificationScenario } from "../../../../fixtures/run-classification-scenario.js";

describe("classifyImage lifecycle", () => {
  test("releases an aborted model-load waiter and reuses the single pending load", async () => {
    const scenario = "load-abort";

    const result = await runClassificationScenario(scenario);

    expect(result.aborted).toBe("AbortError");
    expect(result.competing).toBe("Classifier is busy");
    expect(result.loads).toBe(1);
    expect(result.inferences).toBe(1);
    expect(result.retry.sha256).toBe(result.expectedSha256);
    expect(result.pixels).toEqual({ width: 32, height: 16, channels: 3, bytes: 1536 });
  });

  test("handles a background load rejection after abort and permits a fresh load", async () => {
    const scenario = "load-failure";

    const result = await runClassificationScenario(scenario);

    expect(result.aborted).toBe("AbortError");
    expect(result.loads).toBe(2);
    expect(result.inferences).toBe(1);
    expect(result.retry.sha256).toBe(result.expectedSha256);
  });

  test("keeps the slot during non-preemptible inference and discards the cancelled result", async () => {
    const scenario = "inference-abort";

    const result = await runClassificationScenario(scenario);

    expect(result.settledBeforeInferenceEnded).toBe(false);
    expect(result.competing).toBe("Classifier is busy");
    expect(result.aborted).toBe("AbortError");
    expect(result.loads).toBe(1);
    expect(result.inferences).toBe(2);
    expect(result.retry.sha256).toBe(result.expectedSha256);
  });
});
