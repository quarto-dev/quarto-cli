let http = require("http");
let express = require("express");
let cors = require("cors");
let fs = require("fs");
let io = require("socket.io");
let crypto = require("crypto");

let app = express();
let staticDir = express.static;

app.use(cors()); // enable cors for all origins

let server = http.createServer(app);

let socketsIO = io(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  },
});

let opts = {
  port: process.env.PORT || 1948,
  baseDir: process.cwd(),
};

socketsIO.on("connection", (socket) => {
  console.debug("Connection opened");
  socket.on("multiplex-statechanged", (data) => {
    if (
      typeof data.secret == "undefined" ||
      data.secret == null ||
      data.secret === ""
    )
      return;
    if (createHash(data.secret) === data.socketId) {
      console.debug("Broadcasting state change");
      data.secret = null;
      socket.broadcast.emit(data.socketId, data);
    } else {
      console.warn("Secret and socketId do not match");
    }
  });
});

app.use(express.static(opts.baseDir));

app.get("/", (req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });

  let stream = fs.createReadStream(opts.baseDir + "/index.html");
  stream.on("error", (error) => {
    res.write(
      '<style>body{font-family: sans-serif;}</style><h2>reveal.js multiplex server.</h2><a href="/token">Generate token</a>'
    );
    res.end();
  });
  stream.on("open", () => {
    stream.pipe(res);
  });
});

app.get("/token", (req, res) => {
  let secret = crypto.randomBytes(16).toString("hex");
  res.send({ secret: secret, socketId: createHash(secret) });
});

let createHash = (secret) => {
  let hash = crypto.createHash("sha256").update(secret);
  return hash.digest("hex");
};

// Open the listening port
server.listen(opts.port || null);

console.log(`reveal.js: Multiplex running on port: ${opts.port}`);
