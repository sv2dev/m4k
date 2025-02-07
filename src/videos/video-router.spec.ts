import { describe, expect, it } from "bun:test";
import {
  audioEncoders,
  audioFilters,
  inputFormats,
  outputFormats,
  videoEncoders,
  videoFilters,
} from "./video-optimizer";
import { videoRouter } from "./video-router";

const app = videoRouter();

describe("/process", () => {
  it("should process a video", async () => {
    const query = new URLSearchParams({
      format: "mp4",
    });
    const response = await app.handle(
      new Request(`http://localhost:3000/process?${query}`, {
        method: "POST",
        body: Bun.file("fixtures/video.mp4"),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    const blob = await response.blob();
    expect(await Bun.file("/tmp/output.mp4").exists()).toBe(false);
    expect(blob.size).toBeGreaterThan(1000);
  });

  it("should not stream back, if output is provided", async () => {
    const query = new URLSearchParams({
      format: "mp4",
      output: "/tmp/test-output.mp4",
    });

    const response = await app.handle(
      new Request(`http://localhost:3000/process?${query}`, {
        method: "POST",
        body: Bun.file("fixtures/video.mp4"),
      })
    );

    expect(response.status).toBe(201);
    const blob = await response.blob();
    expect(blob.size).toBe(0);
    const outFile = Bun.file("/tmp/test-output.mp4");
    expect(outFile.size).toBeGreaterThan(1000);
    await outFile.unlink();
  });

  it("should return 400 if no options are provided", async () => {
    const response = await app.handle(
      new Request(`http://localhost:3000/process`, {
        method: "POST",
        body: Bun.file("fixtures/video.mp4"),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toEqual("No options provided");
  });

  it("should return 400 if options are invalid json", async () => {
    const response = await app.handle(
      new Request(`http://localhost:3000/process`, {
        method: "POST",
        body: Bun.file("fixtures/video.mp4"),
        headers: { "X-Options": "{" },
      })
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toEqual("Error while parsing options");
  });

  it("should return 400 if options are invalid", async () => {
    const response = await app.handle(
      new Request(`http://localhost:3000/process`, {
        method: "POST",
        body: Bun.file("fixtures/video.mp4"),
        headers: { "X-Options": JSON.stringify({ fps: "abc" }) },
      })
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toEqual("[/fps] Expected union value");
  });
});

describe("/videos/formats", () => {
  it("should return supported formats", async () => {
    const response = await app.handle(
      new Request("http://localhost:3000/formats")
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual(outputFormats);
  });
});

describe("/videos/input-formats", () => {
  it("should return supported formats", async () => {
    const response = await app.handle(
      new Request("http://localhost:3000/input-formats")
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual(inputFormats);
  });
});

describe("/videos/encoders", () => {
  it("should return supported encoders", async () => {
    const response = await app.handle(
      new Request("http://localhost:3000/encoders")
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual(videoEncoders);
  });
});

describe("/videos/filters", () => {
  it("should return supported filters", async () => {
    const response = await app.handle(
      new Request("http://localhost:3000/filters")
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual(videoFilters);
  });
});

describe("/videos/audio-encoders", () => {
  it("should return supported audio encoders", async () => {
    const response = await app.handle(
      new Request("http://localhost:3000/audio-encoders")
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual(audioEncoders);
  });
});

describe("/videos/audio-filters", () => {
  it("should return supported audio filters", async () => {
    const response = await app.handle(
      new Request("http://localhost:3000/audio-filters")
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual(audioFilters);
  });
});
