import sharp from "sharp";

/** Bounded TIFF IFD0 -> IFD1 JPEG thumbnail extraction; no arbitrary TIFF traversal or RAW development. */
export async function extractEmbeddedPreview(input: Buffer): Promise<Buffer> {
  if (input.byteLength > 128 * 1024 * 1024)
    throw new RangeError("RAW preview input exceeds 128 MiB");
  const little = input.subarray(0, 4).equals(Buffer.from([73, 73, 42, 0]));
  if (input.length < 8 || (!little && !input.subarray(0, 4).equals(Buffer.from([77, 77, 0, 42]))))
    throw new RangeError("Embedded preview requires a TIFF-based camera file");
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const ifd = (offset: number) => {
    if (offset < 8 || offset > input.length - 2)
      throw new RangeError("Invalid embedded preview directory");
    const count = view.getUint16(offset, little);
    if (count > 256 || offset + 2 + count * 12 + 4 > input.length)
      throw new RangeError("Invalid embedded preview directory");
    const tags = new Map<number, number>();
    for (let i = 0; i < count; i++) {
      const at = offset + 2 + i * 12;
      const type = view.getUint16(at + 2, little);
      if (view.getUint32(at + 4, little) !== 1 || (type !== 3 && type !== 4)) continue;
      tags.set(
        view.getUint16(at, little),
        type === 3 ? view.getUint16(at + 8, little) : view.getUint32(at + 8, little),
      );
    }
    return { tags, next: view.getUint32(offset + 2 + count * 12, little) };
  };
  const firstOffset = view.getUint32(4, little);
  const first = ifd(firstOffset);
  if (!first.next || first.next === firstOffset)
    throw new RangeError("No supported embedded JPEG preview");
  const { tags } = ifd(first.next);
  const offset = tags.get(0x201) ?? 0;
  const length = tags.get(0x202) ?? 0;
  if (
    (tags.has(0x103) && tags.get(0x103) !== 6) ||
    offset < 8 ||
    length < 2 ||
    length > 8 * 1024 * 1024 ||
    offset > input.length - length
  )
    throw new RangeError("No supported embedded JPEG preview");
  const jpeg = input.subarray(offset, offset + length);
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8)
    throw new RangeError("No supported embedded JPEG preview");
  const orientation = first.tags.get(0x112) ?? 1;
  // Attach only orientation to the private intermediate; the normal transform applies it.
  return sharp(jpeg, { limitInputPixels: 1024 * 1024 })
    .withMetadata({ orientation: orientation >= 1 && orientation <= 8 ? orientation : 1 })
    .jpeg()
    .toBuffer();
}
