const query = new URLSearchParams({
  format: "mp4",
  videoCodec: "libsvtav1",
});

const res = await fetch(`http://localhost:3000/videos/process?${query}`, {
  method: "POST",
  body: Bun.file("fixtures/video.mp4"),
});

console.log(res.status);
await Bun.write("test.mp4", res);
