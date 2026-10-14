// Connects to the quarto preview dev server websocket and reports what it receives.
import WebSocket from "ws";
const port = process.argv[2] ?? "4321";
const path = process.argv[3] ?? "/";
const ws = new WebSocket(`ws://localhost:${port}${path}`);
const timer = setTimeout(() => { console.log("ws: timeout waiting for messages"); ws.close(); process.exit(2); }, 15000);
ws.on("open", () => console.log("ws: connected"));
ws.on("message", (data) => { console.log("ws: message", String(data).slice(0, 80)); clearTimeout(timer); ws.close(); process.exit(0); });
ws.on("error", (e) => { console.log("ws: error", e.message); process.exit(1); });
ws.on("close", () => console.log("ws: closed"));
