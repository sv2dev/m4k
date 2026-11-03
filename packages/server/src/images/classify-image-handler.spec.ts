import { describe, expect, test } from "bun:test";
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
