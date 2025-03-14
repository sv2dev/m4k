export class VirtualFile {
  constructor(
    readonly stream: ReadableStream,
    readonly name: string,
    readonly type: string
  ) {}
}
