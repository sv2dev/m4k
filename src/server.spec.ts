import { describe, expect, it } from "bun:test";
import { testClient } from "hono/testing";
import { app } from "./server";

describe("server", () => {
  const client = testClient(app);

  it("should process image", async () => {
    const response = await client.process.$post({
      form: {
        file: Bun.file("fixtures/image.jpeg"),
      },
      query: {
        w: 100,
        h: 1000,
        f: "webp",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    const blob = await response.blob();

    expect(blob.size).toBe(312);
  });

  it("should return 500 if image cannot be processed", async () => {
    const response = await client.process.$post({
      form: {
        file: Bun.file("fixtures/image.jpeg"),
      },
      query: { f: "x" },
    });

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Error during image processing");
  });
});
