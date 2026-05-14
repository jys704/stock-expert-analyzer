export function sanitizeStorageSegment(value: string, fallback = "untitled") {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9가-힣_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized.slice(0, 80) || fallback;
}

export function decodePdfDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:application\/pdf(?:;[^,]*)?;base64,(.+)$/);

  if (!match) {
    throw new Error("PDF data URL 형식이 올바르지 않습니다.");
  }

  const buffer = Buffer.from(match[1], "base64");

  if (buffer.length === 0) {
    throw new Error("PDF 파일 내용이 비어 있습니다.");
  }

  return buffer;
}
