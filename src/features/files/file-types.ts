// Tipos de archivo admitidos por bucket. Se usan en el navegador (antes de
// subir) y en el servidor (antes de guardar la referencia); el bucket de
// Supabase repite el límite de tamaño y de tipos.

type FileKind = { mime: string; matches: (header: Uint8Array) => boolean };

const startsWith = (header: Uint8Array, bytes: number[], offset = 0) => bytes.every((byte, index) => header[offset + index] === byte);

const PDF: FileKind = { mime: "application/pdf", matches: (h) => startsWith(h, [0x25, 0x50, 0x44, 0x46]) };
const DOCX: FileKind = { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", matches: (h) => startsWith(h, [0x50, 0x4b]) };
const DOC: FileKind = { mime: "application/msword", matches: (h) => startsWith(h, [0xd0, 0xcf, 0x11, 0xe0]) };
const JPG: FileKind = { mime: "image/jpeg", matches: (h) => startsWith(h, [0xff, 0xd8, 0xff]) };
const PNG: FileKind = { mime: "image/png", matches: (h) => startsWith(h, [0x89, 0x50, 0x4e, 0x47]) };
const WEBP: FileKind = { mime: "image/webp", matches: (h) => startsWith(h, [0x52, 0x49, 0x46, 0x46]) && startsWith(h, [0x57, 0x45, 0x42, 0x50], 8) };
const EPUB: FileKind = { mime: "application/epub+zip", matches: (h) => startsWith(h, [0x50, 0x4b]) };

export const FILE_RULES = {
  "activity-files": {
    maxBytes: 20 * 1024 * 1024,
    label: "PDF, Word o imagen (hasta 20 MB)",
    types: { pdf: PDF, docx: DOCX, doc: DOC, jpg: JPG, jpeg: JPG, png: PNG, webp: WEBP },
  },
  library: {
    maxBytes: 50 * 1024 * 1024,
    label: "PDF o EPUB (hasta 50 MB)",
    types: { pdf: PDF, epub: EPUB },
  },
} as const satisfies Record<string, { maxBytes: number; label: string; types: Record<string, FileKind> }>;

export type FileBucket = keyof typeof FILE_RULES;

export function fileExtension(filename: string) {
  return filename.toLowerCase().split(".").pop() ?? "";
}

export function ruleFor(bucket: FileBucket, extension: string): FileKind | undefined {
  return (FILE_RULES[bucket].types as Record<string, FileKind>)[extension];
}

export function acceptAttribute(bucket: FileBucket) {
  const types = FILE_RULES[bucket].types as Record<string, FileKind>;
  return Object.keys(types).map((ext) => `.${ext}`).concat([...new Set(Object.values(types).map((kind) => kind.mime))]).join(",");
}

/** Rutas generadas por el navegador: `<uuid>/<uuid>.<ext>`. */
export function isValidStoragePath(bucket: FileBucket, path: string, mime: string) {
  const match = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.([a-z0-9]{2,5})$/.exec(path);
  if (!match) return false;
  return ruleFor(bucket, match[1])?.mime === mime;
}
