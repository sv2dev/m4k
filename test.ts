import { Part } from "@sv2dev/multipart-stream";
import { optimizeImage, optimizeVideo } from "./src/client";

for await (const value of optimizeVideo(
  "http://localhost:3000",
  Bun.file("fixtures/video.mp4"),
  { format: "mp4", videoCodec: "libx265" }
)) {
  if (value instanceof Part) {
    const file = Bun.file(value.filename ?? "test.mp4");
    const writer = file.writer();
    for await (const chunk of value) {
      writer.write(chunk);
      await writer.flush();
    }
    await writer.end();
  } else {
    console.log(value);
  }
}

for await (const value of optimizeImage(
  "http://localhost:3000",
  Bun.file("fixtures/image.jpeg"),
  { format: "jpeg", quality: 40 }
)) {
  if (value instanceof Part) {
    const file = Bun.file(value.filename ?? "test.mp4");
    const writer = file.writer();
    for await (const chunk of value) {
      writer.write(chunk);
      await writer.flush();
    }
    await writer.end();
  } else {
    console.log(value);
  }
}
