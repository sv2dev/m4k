const textEncoder = new TextEncoder();

export const BOUNDARY = `-boundary-${Bun.randomUUIDv7("base64url")}`;
const LB = "\r\n";

export function part({
  first,
  filename,
  payload,
  contentType = typeof payload === "string"
    ? "text/plain"
    : payload != undefined
    ? "application/json"
    : undefined,
}: {
  first?: boolean;
  filename?: string;
  contentType?: string;
  payload?: any;
} = {}) {
  const headers = [] as string[];
  if (filename)
    headers.push(`Content-Disposition: attachment; filename="${filename}"`);
  if (contentType) headers.push(`Content-Type: ${contentType}`);

  const lines: string[] = [
    `--${BOUNDARY}`,
    headers.join(LB),
    `${LB}${
      payload
        ? typeof payload === "string"
          ? payload
          : JSON.stringify(payload)
        : ""
    }`,
  ];

  return textEncoder.encode(`${first ? "" : LB}${lines.join(LB)}`);
}

export const END = textEncoder.encode(`${LB}--${BOUNDARY}--${LB}`);
