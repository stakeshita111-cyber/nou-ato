import { supabase } from "@/lib/supabase";

/**
 * Base64 文字列 (data:image/...) または File / Blob を Supabase Storage にアップロードし、公開URLを返却する
 * @param fileOrBase64 - File, Blob, または Base64 文字列
 * @param folder - 保存先フォルダ名（例: "tasks", "records", "beds"）
 * @returns Supabase Storage の公開URL（失敗時はフォールバックとして元の入力値）
 */
export async function uploadImageToStorage(
  fileOrBase64: File | Blob | string | undefined | null,
  folder: string = "general"
): Promise<string> {
  if (!fileOrBase64) return "";

  // すでに http から始まる通常のURLの場合はそのまま返却
  if (typeof fileOrBase64 === "string" && fileOrBase64.startsWith("http")) {
    return fileOrBase64;
  }

  try {
    let blob: Blob;
    let extension = "jpg";

    if (typeof fileOrBase64 === "string") {
      // Base64 文字列 (data:image/jpeg;base64,...) を Blob にデコード
      const match = fileOrBase64.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (!match) {
        return fileOrBase64;
      }

      const mimeSubtype = match[1].toLowerCase();
      extension = mimeSubtype === "jpeg" ? "jpg" : mimeSubtype;
      const base64Data = match[2];
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: `image/${extension === "jpg" ? "jpeg" : extension}` });
    } else {
      blob = fileOrBase64;
      if (fileOrBase64 instanceof File) {
        extension = fileOrBase64.name.split(".").pop()?.toLowerCase() || "jpg";
      }
    }

    // 重複を避けるユニークなファイル名
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("crop-photos")
      .upload(fileName, blob, {
        contentType: blob.type || "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.warn("Supabase Storage upload warning:", uploadError.message);
      return typeof fileOrBase64 === "string" ? fileOrBase64 : "";
    }

    const { data } = supabase.storage.from("crop-photos").getPublicUrl(fileName);
    return data?.publicUrl || (typeof fileOrBase64 === "string" ? fileOrBase64 : "");
  } catch (err) {
    console.error("uploadImageToStorage exception:", err);
    return typeof fileOrBase64 === "string" ? fileOrBase64 : "";
  }
}
