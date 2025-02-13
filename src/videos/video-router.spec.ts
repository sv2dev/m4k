import { streamParts } from "@sv2dev/multipart-stream";
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
    const [, video] = await Array.fromAsync(streamParts(response));

    expect(video.filename).toBe("video.mp4");
    expect((await video.bytes()).length).toBeGreaterThan(1000);
  });

  it("should process multiple videos in sequence", async () => {
    const query = new URLSearchParams({
      format: "mp4",
    });
    const res1 = app.handle(
      new Request(`http://localhost:3000/process?${query}`, {
        method: "POST",
        body: Bun.file("fixtures/video.mp4"),
      })
    );
    const res2 = app.handle(
      new Request(`http://localhost:3000/process?${query}`, {
        method: "POST",
        body: Bun.file("fixtures/video.mp4"),
      })
    );

    const [response1, response2] = await Promise.all([res1, res2]);

    expect(response1.status).toBe(200);
    const [, video1] = await Array.fromAsync(streamParts(response1));
    expect(video1.filename).toBe("video.mp4");
    expect((await video1.bytes()).length).toBeGreaterThan(1000);

    expect(response2.status).toBe(200);
    const [msg21, msg22, video2] = await Array.fromAsync(
      streamParts(response2)
    );
    expect(await msg21.json()).toEqual({ position: 2 });
    expect(await msg22.json()).toEqual({ position: 1 });
    expect(video2.filename).toBe("video.mp4");
    expect((await video2.bytes()).length).toBeGreaterThan(1000);
  });

  it("should stream the queue position", async () => {
    const query = new URLSearchParams({
      format: "mp4",
    });
    const r1 = app.handle(
      new Request(`http://localhost:3000/process?${query}`, {
        method: "POST",
        body: Bun.file("fixtures/video.mp4"),
      })
    );
    const r2 = app.handle(
      new Request(`http://localhost:3000/process?${query}`, {
        method: "POST",
        body: Bun.file("fixtures/video.mp4"),
      })
    );

    const [stream1, stream2] = await Promise.all([
      Array.fromAsync(streamParts(await r1)),
      Array.fromAsync(streamParts(await r2)),
    ]);

    expect(await stream1[0].json()).toEqual({ position: 1 });
    expect(await stream2[0].json()).toEqual({ position: 2 });
    expect(await stream2[1].json()).toEqual({ position: 1 });
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

    expect(response.status).toBe(200);
    const parts = await Array.fromAsync(streamParts(response));
    expect(parts.length).toBe(1);
    expect(await parts[0].json()).toEqual({ position: 1 });
    const file = Bun.file("/tmp/test-output.mp4");
    expect(file.size).toBeGreaterThan(1000);
    await file.unlink();
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
