export class VirtualFile extends Blob {
  name: string;
  constructor(private s: ReadableStream, opts: { name: string; type: string }) {
    super([], { type: opts.type });
    this.name = opts.name;
  }

  override stream() {
    return this.s;
  }
}
