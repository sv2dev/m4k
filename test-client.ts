import { ProcessedFile, processImage, processVideo } from "@m4k/client";

for await (const value of processVideo(
  "http://localhost:3000",
  Bun.file("fixtures/video.mp4"),
  { format: "mp4", videoCodec: "libx265", output: "output/video.mp4" }
)) {
  if (value instanceof ConvertedFile) {
    const file = Bun.file(value.name);
    const writer = file.writer();
    for await (const chunk of value.stream) {
      writer.write(chunk);
      await writer.flush();
    }
    await writer.end();
  } else {
    console.log(value);
  }
}

for await (const value of processImage(
  "http://localhost:3000",
  Bun.file("fixtures/image.jpeg"),
  { format: "jpeg", quality: 40, output: "output/image.jpeg" }
)) {
  if (value instanceof ProcessedFile) {
    const file = Bun.file(value.name);
    const writer = file.writer();
    for await (const chunk of value.stream) {
      writer.write(chunk);
      await writer.flush();
    }
    await writer.end();
  } else {
    console.log(value);
  }
}
