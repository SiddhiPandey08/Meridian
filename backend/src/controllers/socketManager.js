import { Server } from "socket.io";

let connections = {};
let messages = {};
let timeOnline = {};

const connectToSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      allowedHeaders: ["*"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    socket.on("join-call", (roomId) => {
      if (connections[roomId] === undefined) {
        connections[roomId] = [];
      }
      connections[roomId].push(socket.id);
      timeOnline[socket.id] = new Date();

      for (let i = 0; i < connections[roomId].length; i++) {
        io.to(connections[roomId][i]).emit(
          "user-joined",
          socket.id,
          connections[roomId],
        );
      }

      if (messages[roomId] !== undefined) {
        for (let i in messages[roomId]) {
          io.to(socket.id).emit(
            "chat-message",
            messages[roomId][i]["data"],
            messages[roomId][i]["sender"],
            messages[roomId][i]["socket-id-sender"],
          );
        }
      }
    });

    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message);
    });

    socket.on("disconnect", () => {
      var disconnectDuration = Math.abs(timeOnline[socket.id] - new Date());
      let roomOfDisconnectedSocket;

      roomSearch: for (const [roomId, participants] of JSON.parse(
        JSON.stringify(Object.entries(connections)),
      )) {
        for (let i = 0; i < participants.length; ++i) {
          if (participants[i] === socket.id) {
            roomOfDisconnectedSocket = roomId;

            for (
              let j = 0;
              j < connections[roomOfDisconnectedSocket].length;
              ++j
            ) {
              io.to(connections[roomOfDisconnectedSocket][j]).emit(
                "user-left",
                socket.id,
              );
            }

            var socketIndex = connections[roomOfDisconnectedSocket].indexOf(
              socket.id,
            );
            connections[roomOfDisconnectedSocket].splice(socketIndex, 1);

            if (connections[roomOfDisconnectedSocket].length === 0) {
              delete connections[roomOfDisconnectedSocket];
            }

            break roomSearch; // exits both loops at once
          }
        }
      }
    });

    socket.on("chat-message", (message, sender) => {
      const [matchingRoom, found] = Object.entries(connections).reduce(
        ([room, isFound], [roomId, socketsInRoom]) => {
          if (!isFound && socketsInRoom.includes(socket.id)) {
            return [roomId, true];
          }

          return [room, isFound];
        },
        ["", false],
      );

      if (found === true) {
        if (messages[matchingRoom] === undefined) {
          messages[matchingRoom] = [];
        }

        messages[matchingRoom].push({
          sender: sender,
          data: message,
          "socket-id-sender": socket.id,
        });
        console.log("chat-message", matchingRoom, ":", sender, message);

        connections[matchingRoom].forEach((elem) => {
          io.to(elem).emit("chat-message", message, sender, socket.id);
        });
      }
    });
  });

  return io;
};

export default connectToSocket;
