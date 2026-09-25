// Vitest global test setup file
// Node.js 22未満やWebSocket未定義環境でのSupabase Realtime WebSocketエラーを防止

if (typeof globalThis.WebSocket === "undefined") {
  class MockWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSING = 2;
    readonly CLOSED = 3;

    readyState = 1; // OPEN
    url = "";
    protocol = "";
    binaryType = "blob";
    bufferedAmount = 0;
    extensions = "";
    onopen = null;
    onclose = null;
    onerror = null;
    onmessage = null;

    constructor(url: string) {
      this.url = url;
    }

    send() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() {
      return true;
    }
  }

  globalThis.WebSocket = MockWebSocket as any;
}
