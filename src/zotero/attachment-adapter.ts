import type { RawAttachment } from "../domain/metadata";

export type ZoteroAttachmentLike = {
  id: number;
  attachmentContentType?: string;
  getField?: (field: string) => string;
  getFilePathAsync?: () => Promise<string | false>;
  isPDFAttachment?: () => boolean;
};

export async function readAttachment(
  attachment: ZoteroAttachmentLike,
): Promise<RawAttachment> {
  const contentType =
    attachment.attachmentContentType || safeField(attachment, "contentType");
  const isPDF =
    contentType === "application/pdf" ||
    attachment.isPDFAttachment?.() === true;
  let path: string | null = null;
  if (isPDF && attachment.getFilePathAsync) {
    try {
      const filePath = await attachment.getFilePathAsync();
      path = filePath || null;
    } catch (_error) {
      path = null;
    }
  }
  return {
    id: attachment.id,
    contentType: isPDF ? "application/pdf" : contentType,
    path,
    filename: safeField(attachment, "title") || undefined,
  };
}

function safeField(attachment: ZoteroAttachmentLike, field: string): string {
  try {
    return attachment.getField?.(field) || "";
  } catch (_error) {
    return "";
  }
}
