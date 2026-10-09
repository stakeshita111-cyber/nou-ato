import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadImageToStorage } from "../lib/storage";
import { supabase } from "../lib/supabase";

vi.mock("../lib/supabase", () => {
  return {
    supabase: {
      auth: {
        getUser: vi.fn(),
      },
      storage: {
        from: vi.fn(),
      },
    },
  };
});

describe("uploadImageToStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns original URL if input is already an HTTP URL", async () => {
    const httpUrl = "https://example.com/crop.jpg";
    const result = await uploadImageToStorage(httpUrl, "tasks");
    expect(result).toBe(httpUrl);
  });

  it("returns empty string if file/base64 input is null or empty", async () => {
    const result = await uploadImageToStorage(null, "tasks");
    expect(result).toBe("");
  });

  it("includes userId in storage upload path and returns public URL on success", async () => {
    const mockUpload = vi.fn().mockResolvedValue({ error: null });
    const mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: "https://example.com/storage/v1/object/public/crop-photos/user123/tasks_12345.jpg" } });

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: "user123" } as any },
      error: null,
    });

    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    } as any);

    // 有効な Base64 文字列 ("SGVsbG8=" = "Hello")
    const base64Image = "data:image/jpeg;base64,SGVsbG8=";
    const result = await uploadImageToStorage(base64Image, "tasks");

    expect(mockUpload).toHaveBeenCalled();
    const uploadedPath = mockUpload.mock.calls[0][0];
    expect(uploadedPath).toContain("user123/");
    expect(result).toContain("https://example.com/");
  });

  it("returns empty string on upload error and does NOT fall back to raw Base64", async () => {
    const mockUpload = vi.fn().mockResolvedValue({ error: { message: "Storage quota exceeded" } });

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: "user123" } as any },
      error: null,
    });

    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: mockUpload,
      getPublicUrl: vi.fn(),
    } as any);

    const base64Image = "data:image/jpeg;base64,SGVsbG8=";
    const result = await uploadImageToStorage(base64Image, "tasks");

    expect(result).toBe("");
    expect(result).not.toBe(base64Image);
  });
});
