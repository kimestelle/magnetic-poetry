import type { BoardAction } from "./actionHelpers";
import type { WordItem } from "./boardHelpers";

export type RealtimeOpts = {
  url: string;
  boardId: string;
  onAction: (a: BoardAction) => void;
  onStatus?: (s: { connected: boolean }) => void;
};

function safeParse(data: unknown): unknown | null {
  if (typeof data !== "string") return null;
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return null;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isSyncStateMsg(v: unknown): v is { type: "SYNC_STATE"; words: WordItem[] } {
  if (!isRecord(v)) return false;
  if (v.type !== "SYNC_STATE") return false;
  return Array.isArray(v.words);
}

function isBoardAction(v: unknown): v is BoardAction {
  if (!isRecord(v)) return false;

  const t = v.type;
  if (typeof t !== "string") return false;

  switch (t) {
    case "SET_STATE":
      return Array.isArray(v.words);

    case "ADD_WORD":
      return isRecord(v.word);

    case "ADD_WORDS":
      return Array.isArray(v.words);

    case "MOVE_WORD":
      return typeof v.id === "string" && typeof v.xPercent === "number" && typeof v.yPercent === "number";

    case "DELETE_WORD":
      return typeof v.id === "string";

    case "RESET":
      return true;

    default:
      return false;
  }
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

  ws.addEventListener("message", (ev: MessageEvent) => {
    const msg = safeParse(ev.data);
    if (!msg) return;

    if (isSyncStateMsg(msg)) {
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

export function throttleMs<Args extends unknown[]>(
  fn: (...args: Args) => void,
  ms: number
): (...args: Args) => void {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latestArgs: Args | null = null;

  return (...args: Args) => {
    const now = Date.now();
    latestArgs = args;

    const remaining = ms - (now - last);
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      last = now;
      fn(...args);
      latestArgs = null;
      return;
    }

    if (timer) return;

    timer = setTimeout(() => {
      timer = null;
      last = Date.now();
      if (latestArgs) fn(...latestArgs);
      latestArgs = null;
    }, remaining);
  };
}

