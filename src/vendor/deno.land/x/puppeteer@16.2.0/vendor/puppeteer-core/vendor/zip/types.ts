// modified for deno compatibility
// (node specific types commented out.)

// https://www.npmjs.com/package/@types/jszip
// https://unpkg.com/@types/jszip@3.1.7/index.d.ts

// Type definitions for JSZip 3.1
// Project: http://stuk.github.com/jszip/, https://github.com/stuk/jszip
// Definitions by: mzeiher <https://github.com/mzeiher>
//                 forabi <https://github.com/forabi>
//                 Florian Keller <https://github.com/ffflorian>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.3

export type Compression = "STORE" | "DEFLATE";

export interface InputByType {
  base64: string;
  string: string;
  text: string;
  binarystring: string;
  array: number[];
  uint8array: Uint8Array;
  arraybuffer: ArrayBuffer;
  blob: Blob;
  // stream: NodeJS.ReadableStream;
}

export type InputFileFormat = InputByType[keyof InputByType];

export interface JSZipFileOptions {
  /** Set to `true` if the data is `base64` encoded. For example image data from a `<canvas>` element. Plain text and HTML do not need this option. */
  base64?: boolean;
  /**
   * Set to `true` if the data should be treated as raw content, `false` if this is a text. If `base64` is used,
   * this defaults to `true`, if the data is not a `string`, this will be set to `true`.
   */
  binary?: boolean;
  /**
   * The last modification date, defaults to the current date.
   */
  date?: Date;
  compression?: string;
  comment?: string;
  /** Set to `true` if (and only if) the input is a "binary string" and has already been prepared with a `0xFF` mask. */
  optimizedBinaryString?: boolean;
  /** Set to `true` if folders in the file path should be automatically created, otherwise there will only be virtual folders that represent the path to the file. */
  createFolders?: boolean;
  /** Set to `true` if this is a directory and content should be ignored. */
  dir?: boolean;

  /** 6 bits number. The DOS permissions of the file, if any. */
  dosPermissions?: number | null;
  /**
   * 16 bits number. The UNIX permissions of the file, if any.
   * Also accepts a `string` representing the octal value: `"644"`, `"755"`, etc.
   */
  unixPermissions?: number | string | null;
}

export interface JSZipGeneratorOptions<T extends OutputType = OutputType> {
  compression?: Compression;
  compressionOptions?: null | {
    level: number;
  };
  type?: T;
  comment?: string;
  /**
   * mime-type for the generated file.
   * Useful when you need to generate a file with a different extension, ie: “.ods”.
   * @default 'application/zip'
   */
  mimeType?: string;
  encodeFileName?(filename: string): string;
  /** Stream the files and create file descriptors */
  streamFiles?: boolean;
  /** DOS (default) or UNIX */
  platform?: "DOS" | "UNIX";
}

export interface JSZipLoadOptions {
  base64?: boolean;
  checkCRC32?: boolean;
  optimizedBinaryString?: boolean;
  createFolders?: boolean;
  decodeFileName?(filenameBytes: Uint8Array): string;
}

export interface JSZipObject {
  name: string;
  dir: boolean;
  date: Date;
  comment: string;
  /** The UNIX permissions of the file, if any. */
  unixPermissions: number | string | null;
  /** The UNIX permissions of the file, if any. */
  dosPermissions: number | null;
  options: JSZipObjectOptions;

  /**
   * Prepare the content in the asked type.
   * @param type the type of the result.
   * @param onUpdate a function to call on each internal update.
   * @return Promise the promise of the result.
   */
  async<T extends OutputType>(
    type: T,
    onUpdate?: OnUpdateCallback,
  ): Promise<OutputByType[T]>;

  // nodeStream(
  //   type?: "nodestream",
  //   onUpdate?: OnUpdateCallback
  // ): NodeJS.ReadableStream;
}

export interface JSZipObjectOptions {
  compression: Compression;
}

export interface Metadata {
  percent: number;
  currentFile: string;
}

export type OnUpdateCallback = (metadata: Metadata) => void;

export interface OutputByType {
  base64: string;
  text: string;
  string: string;
  binarystring: string;
  array: number[];
  uint8array: Uint8Array;
  arraybuffer: ArrayBuffer;
  blob: Blob;
  // nodebuffer: Buffer;
}

export type OutputType = keyof OutputByType;
