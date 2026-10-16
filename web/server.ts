import { createServer } from "node:http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { setIO } from "./src/lib/io-registry";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));

  const io = new SocketIOServer(httpServer, { path: "/api/socket" });
  setIO(io);

  io.on("connection", (socket) => {
    socket.on("join", (room: string) => {
      if (typeof room === "string") socket.join(room);
    });
    socket.on("leave", (room: string) => {
      if (typeof room === "string") socket.leave(room);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
