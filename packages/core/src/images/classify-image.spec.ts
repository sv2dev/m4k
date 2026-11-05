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

  test("classifies the exact bytes of a converted output on the same call", async () => {
    const scenario = "process-inline";

    const result = await runClassificationScenario(scenario);

    const events = result.events.filter((event: object) => !("position" in event));
    const [start, file, classified, firstDone, second, done] = events;
    expect(start).toEqual({ progress: 0 });
    expect(file.file).toBe("file1.jpeg");
    expect(classified.classification.index).toBe(0);
    expect(classified.classification.sha256).toBe(file.sha256);
    expect(classified.classification.sha256).not.toBe(result.expectedSha256);
    expect(firstDone).toEqual({ progress: 50 });
    expect(second.file).toBe("file2.webp");
    expect(done).toEqual({ progress: 100 });
    expect(result.inferences).toBe(1);
    expect(result.pixels.width).toBe(16);
  });

  test("returns only the classification when the converted file is discarded", async () => {
    const scenario = "process-discard";

    const result = await runClassificationScenario(scenario);

    const files = result.events.filter((event: object) => "file" in event);
    expect(files.map((event: { file: string }) => event.file)).toEqual(["file2.webp"]);
    expect(result.events.filter((event: object) => "classification" in event)).toHaveLength(1);
  });

  test("queues a second conversion for the inference slot instead of failing busy", async () => {
    const scenario = "process-wait";

    const result = await runClassificationScenario(scenario);

    expect(result.inferencesWhileWaiting).toBe(1);
    expect(result.inferences).toBe(2);
    expect(result.first.error).toBeUndefined();
    expect(result.second.error).toBeUndefined();
    expect(result.second.events.some((event: object) => "classification" in event)).toBe(true);
  });
});
