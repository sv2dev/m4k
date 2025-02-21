import { Part } from "@sv2dev/multipart-stream";
import { optimizeVideo } from "./src/client";

for await (const value of optimizeVideo(
  "http://localhost:3000",
  Bun.file("fixtures/x.mp4"),
  { format: "mp4", videoCodec: "libx265" }
)) {
  if (value instanceof Part) {
    const file = Bun.file("test.mp4");
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
