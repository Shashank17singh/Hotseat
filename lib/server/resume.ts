import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { LIMITS } from "../types";
import { ApiError } from "./errors";

const MIN_TEXT_CHARS = 80;

function isPdf(bytes: Uint8Array) {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

function isZip(bytes: Uint8Array) {
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

async function fromPdf(bytes: Uint8Array) {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

async function fromDocx(bytes: Uint8Array) {
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return value;
}

// The file's own bytes decide the parser; the browser-supplied name and type are not trusted.
export async function extractResumeText(file: File) {
  if (file.size > LIMITS.resumeBytes) {
    throw new ApiError("too_large", "That file is over 4 MB. Upload a smaller one or paste the text.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let text: string;
  try {
    if (isPdf(bytes)) text = await fromPdf(bytes);
    else if (isZip(bytes)) text = await fromDocx(bytes);
    else if (/\.(txt|md)$/i.test(file.name)) text = new TextDecoder().decode(bytes);
    else throw new ApiError("unreadable", "Upload a PDF, DOCX or TXT file.");
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("unreadable", "That file could not be read. Try another format or paste the text.");
  }

  return prepareResumeText(text);
}

export function prepareResumeText(raw: string) {
  const cleaned = raw.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length < MIN_TEXT_CHARS) {
    throw new ApiError("unreadable", "No readable text was found. This may be a scanned PDF. Paste the text instead.");
  }
  const truncated = cleaned.length > LIMITS.resumeChars;
  return { text: cleaned.slice(0, LIMITS.resumeChars), truncated };
}
