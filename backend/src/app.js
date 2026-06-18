import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import mongoose from "mongoose";
import connectToSocket from "./controllers/socketManager.js";
import userRoutes from "./routes/usersRoutes.js";

const app = express();
const server = createServer(app);
const io = connectToSocket(server);

app.set("port", process.env.PORT || 5000);
app.use(cors());
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ limit: "50kb", extended: true }));

app.get("/", (req, res) => {
  res.send("At your service");
});

app.use("/api/v1/users", userRoutes);

const start = async () => {
  const connectDB = await mongoose.connect(
    "mongodb://smpd2708_db_user:nftrtYsvj9bs17tH@ac-jrvmwdl-shard-00-00.zzjlx5x.mongodb.net:27017,ac-jrvmwdl-shard-00-01.zzjlx5x.mongodb.net:27017,ac-jrvmwdl-shard-00-02.zzjlx5x.mongodb.net:27017/meridian?ssl=true&replicaSet=atlas-13u348-shard-0&authSource=admin&appName=Cluster0",
  );
  console.log(`Connected to MongoDB Host ${connectDB.connection.host}`);
  server.listen(app.get("port"), () => {
    console.log("Server is running on port 5000");
  });
};
start();
