// Runs inside the production container, against its actual HTTP server.
import { strict as assert } from "node:assert";

const url = "http://127.0.0.1:3000";
let ready = false;
for (let attempt = 0; attempt < 50; attempt++) {
  try {
    const response = await fetch(`${url}/info`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).service, "m4k");
    ready = true;
    break;
  } catch {
    await Bun.sleep(100);
  }
}
assert.ok(ready, "Server did not become ready");
const response = await fetch(`${url}/images/process`, {
  method: "POST",
  headers: { "X-Options": JSON.stringify({ format: "webp", resize: { width: 100 } }) },
  body: Bun.file("/fixtures/image.jpeg"),
  signal: AbortSignal.timeout(15000),
});
assert.equal(response.status, 200);
const body = Buffer.from(await response.arrayBuffer());
assert.ok(body.includes(Buffer.from("image/webp")), "Missing converted image part");
const start = body.indexOf(Buffer.from("RIFF"));
assert.ok(start >= 0, "Missing WebP data");
assert.equal(body.subarray(start + 8, start + 12).toString(), "WEBP");
assert.ok(body.includes(Buffer.from('"progress":100')), "Conversion did not complete");
console.log("Container smoke test passed: /info and JPEG → WebP");
