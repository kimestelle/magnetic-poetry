import http from "http";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
    //debugging endpoint
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

// rooms
const rooms = new Map();
// board states for immediate syncing on join
const boards = new Map();

function joinRoom(ws, boardId) {
  // leave old room if any
  if (ws.boardId) {
    const prev = rooms.get(ws.boardId);
    if (prev) {
      prev.delete(ws);
      if (prev.size === 0) rooms.delete(ws.boardId);
    }
  }

  ws.boardId = boardId;
  if (!rooms.has(boardId)) rooms.set(boardId, new Set());
  rooms.get(boardId).add(ws);
}

function broadcast(boardId, data, exceptWs) {
  const set = rooms.get(boardId);
  if (!set) return;
  for (const client of set) {
    if (client !== exceptWs && client.readyState === client.OPEN) {
      client.send(data);
    }
  }
}

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
    ws.isAlive = true;

    ws.on("pong", () => (ws.isAlive = true));

    ws.on("message", (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch {
            return;
        }

        if (msg.type === "JOIN_BOARD" && typeof msg.boardId === "string") {
            joinRoom(ws, msg.boardId);

            if (!boards.has(msg.boardId)) boards.set(msg.boardId, []);
            ws.send(JSON.stringify({ type: "SYNC_STATE", words: boards.get(msg.boardId) }));
            ws.send(JSON.stringify({ type: "JOINED", boardId: msg.boardId }));
            return;
        }

        // require joining first
        if (!ws.boardId) return;

        const boardId = ws.boardId;
        const state = boards.get(boardId) ?? [];

        // update board state
        switch (msg.type) {
            case "ADD_WORD":
            boards.set(boardId, [...state, msg.word]);
            break;

            case "ADD_WORDS":
            boards.set(boardId, [...state, ...(msg.words ?? [])]);
            break;

            case "MOVE_WORD":
            boards.set(
                boardId,
                state.map((w) =>
                w.id === msg.id ? { ...w, xPercent: msg.xPercent, yPercent: msg.yPercent } : w
                )
            );
            break;

            case "DELETE_WORD":
            boards.set(boardId, state.filter((w) => w.id !== msg.id));
            break;

            case "RESET":
            boards.set(boardId, []);
            break;

            default:
            return; // ignore unknown
        }

        // broadcast to others
        msg.boardId = boardId;
        broadcast(boardId, JSON.stringify(msg), ws);
    });


    ws.on("close", () => {
        if (ws.boardId) {
        const set = rooms.get(ws.boardId);
        if (set) {
            set.delete(ws);
            if (set.size === 0) rooms.delete(ws.boardId);
        }
        }
    });
});

// regularly remove dead connections
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) ws.terminate();
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

server.listen(PORT, () => {
  console.log(`WebSocket server listening on :${PORT}`);
});
