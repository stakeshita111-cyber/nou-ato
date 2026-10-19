import { supabase } from '@/lib/supabase';

/**
 * クライアントサイド画像圧縮ヘルパー (Canvas API)
 * ブラウザ環境において、アスペクト比を維持しつつ指定された最大解像度に収まるようにJPEG形式で圧縮・リサイズする。
 * Node.js環境（Vitest実行時）やCanvas API未対応環境、または画像読み込みエラー時は、元の File/Blob をそのまま返却する（Fail-Safe）。
 */
export async function compressImage(
  fileOrBlob: File | Blob,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.8
): Promise<Blob> {
  if (
    typeof window === 'undefined' ||
    typeof Image === 'undefined' ||
    typeof HTMLCanvasElement === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return fileOrBlob;
  }

  return new Promise((resolve) => {
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(fileOrBlob);
    } catch {
      return resolve(fileOrBlob);
    }

    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      try {
        let width = img.width;
        let height = img.height;

        if (!width || !height) {
          return resolve(fileOrBlob);
        }

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(fileOrBlob);
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (compressedBlob) => {
            if (compressedBlob) {
              resolve(compressedBlob);
            } else {
              resolve(fileOrBlob);
            }
          },
          'image/jpeg',
          quality
        );
      } catch {
        resolve(fileOrBlob);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(fileOrBlob);
    };

    img.src = objectUrl;
  });
}

/**
 * クライアントサイド自動画像圧縮ヘルパー (300KB超の画像を最大1280px WebPに圧縮)
 * 外部ライブラリ非依存（標準 Image + HTMLCanvasElement）。
 * SSR環境、テスト環境(jsdom)、SVG/GIF、または300KB以下の場合は即座に元の File を返却する（Fail-Safe）。
 */
export async function compressImageBeforeUpload(file: File): Promise<File> {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function' ||
    !file.type.startsWith('image/') ||
    file.type === 'image/svg+xml' ||
    file.type === 'image/gif' ||
    file.size <= 300 * 1024
  ) {
    return file;
  }

  return new Promise((resolve) => {
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      return resolve(file);
    }

    const img = new Image();

    img.onload = () => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // ignore
      }

      try {
        let width = img.width;
        let height = img.height;

        if (!width || !height) {
          return resolve(file);
        }

        const maxDimension = 1280;
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        if (typeof canvas.getContext !== 'function') {
          return resolve(file);
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file);
        }

        ctx.drawImage(img, 0, 0, width, height);

        if (typeof canvas.toBlob !== 'function') {
          return resolve(file);
        }

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              return resolve(file);
            }

            try {
              const newFileName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
              const compressedFile = new File([blob], newFileName, {
                type: 'image/webp',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } catch {
              resolve(file);
            }
          },
          'image/webp',
          0.8
        );
      } catch {
        resolve(file);
      }
    };

    img.onerror = () => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // ignore
      }
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Base64 文字列 (data:image/...) または File / Blob を Supabase Storage にアップロードし、公開URLを返却する
 * @param fileOrBase64 - File, Blob, または Base64 文字列
 * @param folder - 保存先フォルダ名（例: "tasks", "records", "beds"）
 * @param userId - オプションのユーザーID（指定がない場合は認証ユーザーから自動取得）
 * @returns Supabase Storage の公開URL（失敗時は空文字列 "" を返却。Base64直保存は廃止）
 */
export async function uploadImageToStorage(
  fileOrBase64: File | Blob | string | undefined | null,
  folder: string = 'general',
  userId?: string
): Promise<string> {
  if (!fileOrBase64) return '';

  // すでに http から始まる通常のURLの場合はそのまま返却
  if (typeof fileOrBase64 === 'string' && fileOrBase64.startsWith('http')) {
    return fileOrBase64;
  }

  try {
    // ユーザーIDの取得 (渡されていない場合は Supabase Auth から取得)
    let currentUserId = userId;
    if (!currentUserId) {
      const { data: authData } = await supabase.auth.getUser();
      currentUserId = authData?.user?.id || 'anonymous';
    }

    let blob: Blob;
    let extension = 'jpg';

    if (typeof fileOrBase64 === 'string') {
      // Base64 文字列 (data:image/jpeg;base64,...) を Blob にデコード
      const match = fileOrBase64.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (!match) {
        console.warn('uploadImageToStorage: Invalid base64 string format');
        return '';
      }

      const mimeSubtype = match[1].toLowerCase();
      extension = mimeSubtype === 'jpeg' ? 'jpg' : mimeSubtype;
      const base64Data = match[2];
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: `image/${extension === 'jpg' ? 'jpeg' : extension}` });
    } else {
      blob = fileOrBase64;
      if (fileOrBase64 instanceof File) {
        extension = fileOrBase64.name.split('.').pop()?.toLowerCase() || 'jpg';
      }
    }

    // クライアント自動圧縮（WebP変換 / 300KB超）
    const file =
      blob instanceof File
        ? blob
        : new File([blob], `image.${extension}`, { type: blob.type || 'image/jpeg' });
    const targetFile = await compressImageBeforeUpload(file);
    if (targetFile.type === 'image/webp') {
      extension = 'webp';
    }

    // ユーザーIDを含むパス形式: <user_id>/<timestamp>_<filename> または <folder>/<user_id>/<timestamp>_<filename>
    // Storage RLS ポリシー (<user_id> プレフィックス) に準拠
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const fileName = `${currentUserId}/${folder}_${Date.now()}_${randomSuffix}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('crop-photos')
      .upload(fileName, targetFile, {
        contentType: targetFile.type || 'image/jpeg',
        upsert: false, // 衝突防止のため upsert は false (ユニークファイル名)
      });

    if (uploadError) {
      console.warn('Supabase Storage upload warning:', uploadError.message);
      // 失敗時は Base64 を DB に直接保存させないよう空文字 "" を返却
      return '';
    }

    const { data } = supabase.storage.from('crop-photos').getPublicUrl(fileName);
    return data?.publicUrl || '';
  } catch (err) {
    console.error('uploadImageToStorage exception:', err);
    return '';
  }
}
