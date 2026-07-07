import { t } from "@/lib/i18n";

// Hard cap on admin file uploads (decoded bytes). Next.js's default 1MB
// server-action body limit already rejects bigger payloads today; this is the
// intentional guard that keeps holding if bodySizeLimit is ever raised for an
// unrelated reason (see issue #67).
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Max base64 length that can encode MAX_UPLOAD_BYTES. Padding quantizes the
// string to 4-char blocks, so a payload 1-2 bytes over the cap can slip
// through — irrelevant at this granularity.
const MAX_BASE64_CHARS = Math.ceil(MAX_UPLOAD_BYTES / 3) * 4;

// Decodes an upload sent as base64 from the client, rejecting oversized
// payloads by string length BEFORE allocating the decoded Buffer.
export function decodeUploadBase64(base64: string): Buffer {
  if (base64.length > MAX_BASE64_CHARS) {
    throw new Error(t.errors.fileTooLarge(MAX_UPLOAD_BYTES / 1024 / 1024));
  }
  return Buffer.from(base64, "base64");
}
