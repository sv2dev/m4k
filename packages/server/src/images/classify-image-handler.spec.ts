import { describe, expect, test } from "bun:test";
import { runClassificationScenario } from "../../../../fixtures/run-classification-scenario.js";
import { classifyImageHandler } from "./classify-image-handler.js";

const config = {
  classifierId: "clip-image-labels",
  classifierVersion: "1",
  labels: ["landscape", "receipt"],
};
const request = (options: unknown, body: Uint8Array = new Uint8Array([1])) =>
  new Request("http://m4k/images/classify", {
    method: "POST",
    headers: { "X-Options": JSON.stringify(options) },
    body,
  });

describe("classifyImageHandler", () => {
  test("returns verified annotations after real JPEG decoding with only the model stubbed", async () => {
    const scenario = "handler-success";

    const result = await runClassificationScenario(scenario);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      classifierId: "clip-image-labels",
      classifierVersion: "1",
      sha256: result.expectedSha256,
      labels: [
        { label: "landscape", score: 0.5 },
        { label: "receipt", score: 0.5 },
      ],
    });
    expect(result.pixels).toEqual({ width: 32, height: 16, channels: 3, bytes: 1536 });
  });

  test("refuses an unsupported classifier before inference", async () => {
    const input = request({ ...config, classifierId: "arbitrary-model" });

    const response = await classifyImageHandler(input);

    expect(response.status).toBe(422);
  });

  test("bounds streamed previews even without a content length", async () => {
    const input = request(config, new Uint8Array(8 * 1024 * 1024 + 1));

    const response = await classifyImageHandler(input);

    expect(response.status).toBe(413);
  });

  test("never falls back to classifying an invalid image", async () => {
    const input = request(config);

    const response = await classifyImageHandler(input);

    expect(response.status).toBe(422);
  });
});
