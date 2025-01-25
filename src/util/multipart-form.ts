const textEncoder = new TextEncoder();

const FB = `--file-boundary`;
const LB = "\r\n";

export function fileBoundary(opts: {
  first?: boolean;
  name: string;
  filename: string;
  contentType: string;
}): Uint8Array;
export function fileBoundary(): Uint8Array;
export function fileBoundary({
  first,
  name,
  filename,
  contentType,
}: {
  first?: boolean;
  name?: string;
  filename?: string;
  contentType?: string;
} = {}) {
  const last = !first && !name && !filename && !contentType;
  const lines: string[] = [
    ...(first ? [] : [LB]),
    ...(!last
      ? [
          FB,
          `Content-Disposition: form-data; name="${name}"; filename="${filename}"`,
          `Content-Type: ${contentType}`,
          LB,
        ]
      : [`${FB}--${LB}`]),
  ];
  return textEncoder.encode(lines.join(LB));
}
