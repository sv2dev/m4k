import {
  imageClassifier,
  encodeOptions,
  isValidClassificationResult,
  validateClassificationOptions,
  type ClassificationOptions,
  type ClassificationResult,
} from "@m4k/common";

import { readJsonResponse } from "./read-json-response.js";

/** No local fallback: uploads only after the server advertises the pinned classifier. */
export async function classifyImage(
  host: string,
  input: Blob,
  options: ClassificationOptions,
  { signal }: { signal?: AbortSignal } = {},
): Promise<ClassificationResult> {
  if (!validateClassificationOptions(options))
    throw new RangeError("Unsupported classifier configuration");
  if (input.size > imageClassifier.maxBytes)
    throw new RangeError("Classification preview exceeds byte limit");
  const init = signal ? { signal } : {};
  const infoResponse = await fetch(`${host}/info`, { ...init, redirect: "error" });
  if (!infoResponse.ok) throw new Error(`M4K capability check failed (${infoResponse.status})`);
  const info = (await readJsonResponse(infoResponse)) as {
    service?: string;
    classifiers?: { id: string; version: string; revision: string }[];
  };
  if (
    info.service !== "m4k" ||
    !Array.isArray(info.classifiers) ||
    !info.classifiers.some(
      (c) =>
        c.id === imageClassifier.id &&
        c.version === imageClassifier.version &&
        c.revision === imageClassifier.revision,
    )
  )
    throw new RangeError("M4K does not advertise the requested classifier");
  const response = await fetch(`${host}/images/classify`, {
    ...init,
    method: "POST",
    body: input,
    redirect: "error",
    headers: { "Content-Type": "application/octet-stream", "X-Options": encodeOptions(options) },
  });
  if (!response.ok) throw new Error(`M4K classification failed (${response.status})`);
  const result = (await readJsonResponse(response)) as ClassificationResult;
  if (!isValidClassificationResult(result, options)) throw new Error("Invalid classification response");
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", await input.arrayBuffer()));
  const sha256 = [...hash].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (result.sha256 !== sha256)
    throw new Error("Classification response belongs to different bytes");
  return result;
}
