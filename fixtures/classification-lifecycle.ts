// Child-process fixture: mock only the model boundary, keeping real Sharp decoding and handlers.
import { mock } from "bun:test";
import sharp from "sharp";

const scenario = Bun.argv[2];
const loadStarted = Promise.withResolvers<void>();
const pendingLoad = Promise.withResolvers<typeof infer>();
const inferenceStarted = Promise.withResolvers<void>();
const pendingInference = Promise.withResolvers<void>();
let loads = 0;
let inferences = 0;
let pixels: object | undefined;

async function infer(_image: unknown, labels: string[]) {
  inferences++;
  if (["inference-abort", "process-wait"].includes(scenario) && inferences === 1) {
    inferenceStarted.resolve();
    await pendingInference.promise;
  }
  return labels.map((label) => ({ label, score: 1 / labels.length }));
}

mock.module("@huggingface/transformers", () => ({
  env: {},
  pipeline: async () => {
    loads++;
    if (scenario.startsWith("load-") && loads === 1) {
      loadStarted.resolve();
      return pendingLoad.promise;
    }
    return infer;
  },
  RawImage: class {
    constructor(data: Uint8ClampedArray, width: number, height: number, channels: number) {
      pixels = { width, height, channels, bytes: data.length };
    }
  },
}));

const bytes = await sharp({ create: { width: 32, height: 16, channels: 3, background: "red" } })
  .jpeg()
  .toBuffer();
const options = {
  classifierId: "clip-image-labels",
  classifierVersion: "1",
  labels: ["landscape", "receipt"],
};
const expectedSha256 = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

/** Drains `processImage` (or the server handler's parts) into plain, comparable events. */
async function collect(events: AsyncIterable<unknown>) {
  const out: unknown[] = [];
  for await (const event of events) {
    if (typeof event === "object" && event !== null && "stream" in event && "name" in event) {
      const chunks: Uint8Array[] = [];
      for await (const chunk of event.stream as AsyncIterable<Uint8Array>) chunks.push(chunk);
      const data = Buffer.concat(chunks);
      out.push({
        file: event.name as string,
        sha256: new Bun.CryptoHasher("sha256").update(data).digest("hex"),
      });
    } else out.push(event);
  }
  return out;
}

if (scenario === "process-inline" || scenario === "process-discard") {
  const { processImage } = await import("../packages/core/src/images/image-processor.ts");
  const events = await collect(
    processImage(new Blob([bytes], { type: "image/jpeg" }), [
      {
        format: "jpeg",
        resize: { width: 16 },
        classify: options,
        ...(scenario === "process-discard" ? { discard: true } : {}),
      },
      { format: "webp" },
    ])!,
  );
  console.log(JSON.stringify({ events, loads, inferences, pixels, expectedSha256 }));
} else if (scenario === "handler-process") {
  const { processImageHandler } =
    await import("../packages/server/src/images/process-image-handler.ts");
  const response = await processImageHandler(
    new Request("http://m4k/images/process", {
      method: "POST",
      body: bytes,
      headers: {
        "X-Options": JSON.stringify([
          { format: "jpeg", resize: { width: 16 }, classify: options, discard: true },
          { format: "webp", name: "keep.webp" },
        ]),
      },
    }),
  );
  console.log(JSON.stringify({ status: response.status, body: await response.text(), inferences }));
} else if (scenario === "process-wait") {
  const { processImage } = await import("../packages/core/src/images/image-processor.ts");
  const run = () =>
    collect(processImage(new Blob([bytes], { type: "image/jpeg" }), { format: "jpeg", classify: options })!).then(
      (events) => ({ events }),
      (error: Error) => ({ error: error.message }),
    );
  const first = run();
  await inferenceStarted.promise;
  const second = run();
  // Let the second conversion finish and reach the occupied inference slot.
  await Bun.sleep(300);
  const inferencesWhileWaiting = inferences;
  pendingInference.resolve();
  console.log(
    JSON.stringify({ first: await first, second: await second, inferencesWhileWaiting, inferences }),
  );
} else if (scenario === "handler-success") {
  const { classifyImageHandler } =
    await import("../packages/server/src/images/classify-image-handler.ts");
  const response = await classifyImageHandler(
    new Request("http://m4k/images/classify", {
      method: "POST",
      body: bytes,
      headers: { "X-Options": JSON.stringify(options) },
    }),
  );
  console.log(
    JSON.stringify({
      status: response.status,
      body: await response.json(),
      expectedSha256,
      pixels,
      loads,
      inferences,
    }),
  );
} else {
  const { classifyImage } = await import("../packages/core/src/images/classify-image.ts");
  const ctrl = new AbortController();
  let settled = false;
  const first = classifyImage(bytes, options, { signal: ctrl.signal }).then(
    () => {
      settled = true;
      return "completed";
    },
    (error: Error) => {
      settled = true;
      return error.name;
    },
  );
  if (scenario.startsWith("load-")) {
    await loadStarted.promise;
    ctrl.abort();
    const aborted = await first;
    if (scenario === "load-abort") {
      const retry = classifyImage(bytes, options);
      const competing = await classifyImage(bytes, options).then(
        () => "unexpected",
        (error: Error) => error.message,
      );
      pendingLoad.resolve(infer);
      console.log(
        JSON.stringify({
          aborted,
          competing,
          retry: await retry,
          loads,
          inferences,
          expectedSha256,
          pixels,
        }),
      );
    } else {
      pendingLoad.reject(new Error("background load failed"));
      const retry = await classifyImage(bytes, options);
      console.log(JSON.stringify({ aborted, retry, loads, inferences, expectedSha256, pixels }));
    }
  } else if (scenario === "inference-abort") {
    await inferenceStarted.promise;
    ctrl.abort();
    const competing = await classifyImage(bytes, options).then(
      () => "unexpected",
      (error: Error) => error.message,
    );
    const settledBeforeInferenceEnded = settled;
    pendingInference.resolve();
    const aborted = await first;
    const retry = await classifyImage(bytes, options);
    console.log(
      JSON.stringify({
        aborted,
        competing,
        settledBeforeInferenceEnded,
        retry,
        loads,
        inferences,
        expectedSha256,
        pixels,
      }),
    );
  } else {
    throw new Error(`Unknown scenario: ${scenario}`);
  }
}
