import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { uploadImageToStorage, compressImage } from '../lib/storage';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => {
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

describe('uploadImageToStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns original URL if input is already an HTTP URL', async () => {
    const httpUrl = 'https://example.com/crop.jpg';
    const result = await uploadImageToStorage(httpUrl, 'tasks');
    expect(result).toBe(httpUrl);
  });

  it('returns empty string if file/base64 input is null or empty', async () => {
    const result = await uploadImageToStorage(null, 'tasks');
    expect(result).toBe('');
  });

  it('includes userId in storage upload path and returns public URL on success', async () => {
    const mockUpload = vi.fn().mockResolvedValue({ error: null });
    const mockGetPublicUrl = vi.fn().mockReturnValue({
      data: {
        publicUrl:
          'https://example.com/storage/v1/object/public/crop-photos/user123/tasks_12345.jpg',
      },
    });

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user123' } as unknown as User },
      error: null,
    });

    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    } as unknown as ReturnType<typeof supabase.storage.from>);

    // 有効な Base64 文字列 ("SGVsbG8=" = "Hello")
    const base64Image = 'data:image/jpeg;base64,SGVsbG8=';
    const result = await uploadImageToStorage(base64Image, 'tasks');

    expect(mockUpload).toHaveBeenCalled();
    const uploadedPath = mockUpload.mock.calls[0][0];
    expect(uploadedPath).toContain('user123/');
    expect(result).toContain('https://example.com/');
  });

  it('returns empty string on upload error and does NOT fall back to raw Base64', async () => {
    const mockUpload = vi.fn().mockResolvedValue({ error: { message: 'Storage quota exceeded' } });

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user123' } as unknown as User },
      error: null,
    });

    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: mockUpload,
      getPublicUrl: vi.fn(),
    } as unknown as ReturnType<typeof supabase.storage.from>);

    const base64Image = 'data:image/jpeg;base64,SGVsbG8=';
    const result = await uploadImageToStorage(base64Image, 'tasks');

    expect(result).toBe('');
    expect(result).not.toBe(base64Image);
  });
});

describe('compressImage', () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalImage = global.Image;
  const originalHTMLCanvasElement = global.HTMLCanvasElement;
  const originalURL = global.URL;

  beforeEach(() => {
    vi.clearAllMocks();
    global.window = originalWindow;
    global.document = originalDocument;
    global.Image = originalImage;
    global.HTMLCanvasElement = originalHTMLCanvasElement;
    global.URL = originalURL;
  });

  it('returns original Blob in non-browser (Node.js) environment', async () => {
    const blob = new Blob(['dummy content'], { type: 'image/png' });
    const result = await compressImage(blob);
    expect(result).toBe(blob);
  });

  it('compresses and resizes large image in browser environment maintaining aspect ratio', async () => {
    const mockBlob = new Blob(['compressed content'], { type: 'image/jpeg' });
    let createdObjectUrl = '';
    let revokedObjectUrl = '';

    const mockCtx = {
      drawImage: vi.fn(),
    };

    let canvasWidth = 0;
    let canvasHeight = 0;

    const mockCanvas = {
      get width() {
        return canvasWidth;
      },
      set width(v: number) {
        canvasWidth = v;
      },
      get height() {
        return canvasHeight;
      },
      set height(v: number) {
        canvasHeight = v;
      },
      getContext: vi.fn().mockReturnValue(mockCtx),
      toBlob: vi.fn((callback: (blob: Blob | null) => void, type?: string, quality?: number) => {
        expect(type).toBe('image/jpeg');
        expect(quality).toBe(0.8);
        callback(mockBlob);
      }),
    };

    class MockImage {
      width = 2400;
      height = 1200;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';

      get src() {
        return this._src;
      }
      set src(value: string) {
        this._src = value;
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    }

    // Mock browser environment
    global.window = {} as unknown as Window & typeof globalThis;
    global.HTMLCanvasElement = function () {} as unknown as typeof HTMLCanvasElement;
    global.Image = MockImage as unknown as typeof Image;
    global.URL = {
      createObjectURL: vi.fn().mockImplementation((_blob: Blob) => {
        createdObjectUrl = 'blob:http://localhost/12345';
        return createdObjectUrl;
      }),
      revokeObjectURL: vi.fn().mockImplementation((url: string) => {
        revokedObjectUrl = url;
      }),
    } as unknown as typeof URL;

    global.document = {
      createElement: vi.fn().mockImplementation((tagName: string) => {
        if (tagName === 'canvas') {
          return mockCanvas;
        }
        return {};
      }),
    } as unknown as Document;

    const inputBlob = new Blob(['large image data'], { type: 'image/jpeg' });
    const compressedResult = await compressImage(inputBlob, 1200, 1200, 0.8);

    expect(compressedResult).toBe(mockBlob);
    expect(createdObjectUrl).toBe('blob:http://localhost/12345');
    expect(revokedObjectUrl).toBe('blob:http://localhost/12345');
    expect(canvasWidth).toBe(1200);
    expect(canvasHeight).toBe(600);
    expect(mockCtx.drawImage).toHaveBeenCalled();
  });

  it('keeps original dimensions when image is smaller than max limits', async () => {
    const mockBlob = new Blob(['small compressed content'], { type: 'image/jpeg' });

    let canvasWidth = 0;
    let canvasHeight = 0;

    const mockCanvas = {
      get width() {
        return canvasWidth;
      },
      set width(v: number) {
        canvasWidth = v;
      },
      get height() {
        return canvasHeight;
      },
      set height(v: number) {
        canvasHeight = v;
      },
      getContext: vi.fn().mockReturnValue({ drawImage: vi.fn() }),
      toBlob: vi.fn((callback: (blob: Blob | null) => void) => {
        callback(mockBlob);
      }),
    };

    class MockImage {
      width = 800;
      height = 600;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    }

    global.window = {} as unknown as Window & typeof globalThis;
    global.HTMLCanvasElement = function () {} as unknown as typeof HTMLCanvasElement;
    global.Image = MockImage as unknown as typeof Image;
    global.URL = {
      createObjectURL: vi.fn().mockReturnValue('blob:mock'),
      revokeObjectURL: vi.fn(),
    } as unknown as typeof URL;

    global.document = {
      createElement: vi.fn().mockImplementation((tagName: string) => {
        if (tagName === 'canvas') {
          return mockCanvas;
        }
        return {};
      }),
    } as unknown as Document;

    const inputBlob = new Blob(['small image data'], { type: 'image/png' });
    const result = await compressImage(inputBlob, 1200, 1200, 0.8);

    expect(result).toBe(mockBlob);
    expect(canvasWidth).toBe(800);
    expect(canvasHeight).toBe(600);
  });

  it('falls back to original file/blob when image fails to load', async () => {
    class MockFailedImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        setTimeout(() => {
          if (this.onerror) this.onerror();
        }, 0);
      }
    }

    global.window = {} as unknown as Window & typeof globalThis;
    global.HTMLCanvasElement = function () {} as unknown as typeof HTMLCanvasElement;
    global.Image = MockFailedImage as unknown as typeof Image;
    global.URL = {
      createObjectURL: vi.fn().mockReturnValue('blob:failed'),
      revokeObjectURL: vi.fn(),
    } as unknown as typeof URL;

    const inputBlob = new Blob(['corrupted image data'], { type: 'image/jpeg' });
    const result = await compressImage(inputBlob);

    expect(result).toBe(inputBlob);
  });
});
