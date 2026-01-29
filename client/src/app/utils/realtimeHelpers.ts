import type { BoardAction } from "./actionHelpers";

export type RealtimeOpts = {
  url: string;
  boardId: string;
  onAction: (a: BoardAction) => void;
  onStatus?: (s: { connected: boolean }) => void;
};

function safeParse(data: unknown): any | null {
  if (typeof data !== "string") return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function isBoardAction(msg: any): msg is BoardAction {
  if (!msg || typeof msg !== "object") return false;
  const t = msg.type;
  return (
    t === "SET_STATE" ||
    t === "ADD_WORD" ||
    t === "ADD_WORDS" ||
    t === "MOVE_WORD" ||
    t === "DELETE_WORD" ||
    t === "RESET"
  );
}

// websocket client for a board
export function createBoardSocketClient(opts: RealtimeOpts) {
  const { url, boardId, onAction, onStatus } = opts;

  const ws = new WebSocket(url);
  let connected = false;

  ws.addEventListener("open", () => {
    connected = true;
    onStatus?.({ connected: true });
    ws.send(JSON.stringify({ type: "JOIN_BOARD", boardId }));
  });

  ws.addEventListener("close", () => {
    connected = false;
    onStatus?.({ connected: false });
  });

  ws.addEventListener("message", (ev) => {
    const msg = safeParse(ev.data);
    if (!msg) return;

    if (msg.type === "SYNC_STATE" && Array.isArray(msg.words)) {
      onAction({ type: "SET_STATE", words: msg.words });
      return;
    }

    if (isBoardAction(msg)) onAction(msg);
  });

  function sendAction(action: BoardAction) {
    if (!connected || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(action));
  }

  function close() {
    ws.close();
  }

  return { ws, sendAction, close };
}


export function throttleMs<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let last = 0;
  let timer: number | null = null;
  let latestArgs: any[] | null = null;

  const throttled = ((...args: any[]) => {
    const now = Date.now();
    latestArgs = args;

    const remaining = ms - (now - last);
    if (remaining <= 0) {
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
      last = now;
      fn(...args);
      latestArgs = null;
      return;
    }

    if (timer) return;

    timer = window.setTimeout(() => {
      timer = null;
      last = Date.now();
      if (latestArgs) fn(...(latestArgs as any[]));
      latestArgs = null;
    }, remaining);
  }) as T;

  return throttled;
}
