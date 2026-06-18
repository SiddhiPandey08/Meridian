import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import io from "socket.io-client";
import { TextField, Button, IconButton, Badge } from "@mui/material";
import styles from "../styles/videoComponent.module.css";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import ChatIcon from "@mui/icons-material/Chat";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import PeopleIcon from "@mui/icons-material/People";

const server_url = "http://localhost:5000"; // Replace with your server URL
var connections = {};
const peerConfigConnection = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function VideoMeetComponent() {
  // ─── Refs ────────────────────────────────────────────────────────────────
  var socketRef = useRef();
  let socketIdRef = useRef();
  let localVideoref = useRef();
  const videoRef = useRef([]);
  const chatEndRef = useRef(null);

  // ─── Router ──────────────────────────────────────────────────────────────
  const { url } = useParams();
  const navigate = useNavigate();

  // ─── State ───────────────────────────────────────────────────────────────
  let [videoAvailable, setVideoAvailable] = useState(true);
  let [audioAvailable, setAudioAvailable] = useState(true);
  let [video, setVideo] = useState([]);
  let [audio, setAudio] = useState();
  let [screen, setScreen] = useState();
  let [screenAvailable, setScreenAvailable] = useState();
  let [messages, setMessages] = useState([]);
  let [message, setMessage] = useState("");
  let [newMessages, setNewMessages] = useState(0);
  let [askForUsername, setAskForUsername] = useState(true);
  let [username, setUsername] = useState("");
  let [videos, setVideos] = useState([]);
  let [chatOpen, setChatOpen] = useState(false);
  // spotlightId: which remote video is the main speaker (null = show local)
  let [spotlightId, setSpotlightId] = useState(null);
  // screenView: when screen sharing is active, toggle between 'screen' and 'camera'
  let [screenView, setScreenView] = useState("screen");

  // ─── STEP 1: On mount — ask for camera/mic permissions ───────────────────
  useEffect(() => {
    getPermissions();
  });

  const getPermissions = async () => {
    try {
      const videoPermission = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      if (videoPermission) {
        setVideoAvailable(true);
      } else {
        setVideoAvailable(false);
      }

      const audioPermission = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (audioPermission) {
        setAudioAvailable(true);
      } else {
        setAudioAvailable(false);
      }

      if (navigator.mediaDevices.getDisplayMedia) {
        setScreenAvailable(true);
      } else {
        setScreenAvailable(false);
      }

      if (videoAvailable || audioAvailable) {
        const userMediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoAvailable,
          audio: audioAvailable,
        });
        if (userMediaStream) {
          window.localStream = userMediaStream;
          if (localVideoref.current) {
            localVideoref.current.srcObject = userMediaStream;
          }
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  // ─── STEP 2: User clicks Connect ─────────────────────────────────────────
  let connect = () => {
    setAskForUsername(false);
    getMedia();
  };

  let getMedia = () => {
    setVideo(videoAvailable);
    setAudio(audioAvailable);
    connectToSocketServer();
  };

  // ─── STEP 3: Get local camera/mic stream ─────────────────────────────────
  useEffect(() => {
    if (video !== undefined && audio !== undefined) {
      getUserMedia();
    }
  }, [video, audio]);

  let getUserMedia = () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      navigator.mediaDevices
        .getUserMedia({ video: video, audio: audio })
        .then(getUserMediaSuccess)
        .then((stream) => {})
        .catch((e) => console.log(e));
    } else {
      try {
        let tracks = localVideoref.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      } catch (e) {}
    }
  };

  let getUserMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    localVideoref.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketIdRef.current) continue;
      connections[id].addStream(window.localStream);
      connections[id].createOffer().then((description) => {
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socketRef.current.emit(
              "signal",
              id,
              JSON.stringify({ sdp: connections[id].localDescription }),
            );
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          setVideo(false);
          setAudio(false);
          try {
            let tracks = localVideoref.current.srcObject.getTracks();
            tracks.forEach((track) => track.stop());
          } catch (e) {
            console.log(e);
          }

          let blackSilence = (...args) =>
            new MediaStream([black(...args), silence()]);
          window.localStream = blackSilence();
          localVideoref.current.srcObject = window.localStream;

          for (let id in connections) {
            connections[id].addStream(window.localStream);
            connections[id].createOffer().then((description) => {
              connections[id]
                .setLocalDescription(description)
                .then(() => {
                  socketRef.current.emit(
                    "signal",
                    id,
                    JSON.stringify({ sdp: connections[id].localDescription }),
                  );
                })
                .catch((e) => console.log(e));
            });
          }
        }),
    );
  };

  // ─── STEP 4: Connect to socket server ────────────────────────────────────
  let connectToSocketServer = () => {
    socketRef.current = io.connect(server_url, { secure: false });
    socketRef.current.on("signal", gotMessageFromServer);

    socketRef.current.on("connect", () => {
      socketRef.current.emit("join-call", window.location.href);
      socketIdRef.current = socketRef.current.id;

      socketRef.current.on("chat-message", addMessage);

      socketRef.current.on("user-left", (id) => {
        setVideos((videos) => videos.filter((video) => video.socketId !== id));
        setSpotlightId((prev) => (prev === id ? null : prev));
      });

      socketRef.current.on("user-joined", (id, clients) => {
        clients.forEach((socketListId) => {
          connections[socketListId] = new RTCPeerConnection(
            peerConfigConnection,
          );

          connections[socketListId].onicecandidate = function (event) {
            if (event.candidate != null) {
              socketRef.current.emit(
                "signal",
                socketListId,
                JSON.stringify({ ice: event.candidate }),
              );
            }
          };

          connections[socketListId].onaddstream = (event) => {
            let videoExists = videoRef.current.find(
              (video) => video.socketId === socketListId,
            );
            if (videoExists) {
              setVideos((videos) => {
                const updatedVideos = videos.map((video) =>
                  video.socketId === socketListId
                    ? { ...video, stream: event.stream }
                    : video,
                );
                videoRef.current = updatedVideos;
                return updatedVideos;
              });
            } else {
              let newVideo = {
                socketId: socketListId,
                stream: event.stream,
                autoplay: true,
                playsinline: true,
              };
              setVideos((videos) => {
                const updatedVideos = [...videos, newVideo];
                videoRef.current = updatedVideos;
                // auto-spotlight first remote user
                if (updatedVideos.length === 1) setSpotlightId(socketListId);
                return updatedVideos;
              });
            }
          };

          if (window.localStream !== undefined && window.localStream !== null) {
            connections[socketListId].addStream(window.localStream);
          } else {
            let blackSilence = (...args) =>
              new MediaStream([black(...args), silence()]);
            window.localStream = blackSilence();
            connections[socketListId].addStream(window.localStream);
          }
        });

        if (id === socketIdRef.current) {
          for (let id2 in connections) {
            if (id2 === socketIdRef.current) continue;
            try {
              connections[id2].addStream(window.localStream);
            } catch (e) {}
            connections[id2].createOffer().then((description) => {
              connections[id2]
                .setLocalDescription(description)
                .then(() => {
                  socketRef.current.emit(
                    "signal",
                    id2,
                    JSON.stringify({ sdp: connections[id2].localDescription }),
                  );
                })
                .catch((e) => console.log(e));
            });
          }
        }
      });
    });
  };

  // ─── STEP 5: Handle incoming WebRTC signals (SDP + ICE) ──────────────────
  let gotMessageFromServer = (fromId, message) => {
    var signal = JSON.parse(message);
    if (fromId !== socketIdRef.current) {
      if (signal.sdp) {
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            if (signal.sdp.type === "offer") {
              connections[fromId]
                .createAnswer()
                .then((description) => {
                  connections[fromId]
                    .setLocalDescription(description)
                    .then(() => {
                      socketRef.current.emit(
                        "signal",
                        fromId,
                        JSON.stringify({
                          sdp: connections[fromId].localDescription,
                        }),
                      );
                    });
                })
                .catch((e) => console.log(e));
            }
          })
          .catch((e) => console.log(e));
      }

      // ICE must be outside the sdp block
      if (signal.ice) {
        connections[fromId]
          .addIceCandidate(new RTCIceCandidate(signal.ice))
          .catch((e) => console.log(e));
      }
    }
  };

  // ─── Screen share ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== undefined) getDislayMedia();
  }, [screen]);

  let getDislayMedia = () => {
    if (screen) {
      if (navigator.mediaDevices.getDisplayMedia) {
        navigator.mediaDevices
          .getDisplayMedia({ video: true, audio: true })
          .then(getDislayMediaSuccess)
          .then((stream) => {})
          .catch((e) => console.log(e));
      }
    }
  };

  let getDislayMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }
    window.localStream = stream;
    localVideoref.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketIdRef.current) continue;
      connections[id].addStream(window.localStream);
      connections[id].createOffer().then((description) => {
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socketRef.current.emit(
              "signal",
              id,
              JSON.stringify({ sdp: connections[id].localDescription }),
            );
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          setScreen(false);
          try {
            let tracks = localVideoref.current.srcObject.getTracks();
            tracks.forEach((track) => track.stop());
          } catch (e) {
            console.log(e);
          }
          let blackSilence = (...args) =>
            new MediaStream([black(...args), silence()]);
          window.localStream = blackSilence();
          localVideoref.current.srcObject = window.localStream;
          getUserMedia();
        }),
    );
  };

  // ─── Utility: silence + black stream generators ───────────────────────────
  let silence = () => {
    let ctx = new AudioContext();
    let oscillator = ctx.createOscillator();
    let dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };

  let black = ({ width = 640, height = 480 } = {}) => {
    let canvas = Object.assign(document.createElement("canvas"), {
      width,
      height,
    });
    canvas.getContext("2d").fillRect(0, 0, width, height);
    let stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  // ─── Controls ─────────────────────────────────────────────────────────────
  let handleVideo = () => {
    // toggle the track enabled state directly — no renegotiation needed
    if (window.localStream) {
      window.localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
    setVideo(!video);
  };

  let handleAudio = () => {
    if (window.localStream) {
      window.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
    setAudio(!audio);
  };
  let handleScreen = () => {
    if (screen) setScreenView("screen"); // reset on stop
    setScreen(!screen);
  };

  let handleEndCall = () => {
    try {
      let tracks = localVideoref.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
    } catch (e) {}
    window.location.href = "/";
  };

  let toggleChat = () => {
    setChatOpen((prev) => {
      if (!prev) setNewMessages(0);
      return !prev;
    });
  };

  // ─── Chat ─────────────────────────────────────────────────────────────────
  const addMessage = (data, sender, socketIdSender) => {
    setMessages((prevMessages) => [...prevMessages, { sender, data }]);
    if (socketIdSender !== socketIdRef.current) {
      setNewMessages((prev) => prev + 1);
    }
  };

  useEffect(() => {
    if (chatEndRef.current)
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  let sendMessage = () => {
    if (!message.trim()) return;
    socketRef.current.emit("chat-message", message, username);
    setMessage("");
  };

  let handleMessageKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ─── Spotlight helpers ────────────────────────────────────────────────────
  const spotlightVideo = videos.find((v) => v.socketId === spotlightId);
  const stripVideos = videos.filter((v) => v.socketId !== spotlightId);

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div>
      {askForUsername === true ? (
        /* ── Lobby ── */
        <div className={styles.lobbyContainer}>
          <div className={styles.lobbyCard}>
            <div className={styles.lobbyBrand}>
              <span className={styles.lobbyLogo}>M</span>
              <h1 className={styles.lobbyTitle}>Meridian</h1>
            </div>
            <p className={styles.lobbySubtitle}>
              Enter your name to join the call
            </p>
            <div className={styles.lobbyPreview}>
              <video
                ref={localVideoref}
                autoPlay
                muted
                className={styles.lobbyVideo}
              ></video>
              <div className={styles.lobbyVideoLabel}>Preview</div>
            </div>
            <TextField
              fullWidth
              label="Your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && connect()}
              variant="outlined"
              sx={{
                "& .MuiOutlinedInput-root": {
                  color: "#e8eaf6",
                  "& fieldset": { borderColor: "#3d5a99" },
                  "&:hover fieldset": { borderColor: "#F4B942" },
                  "&.Mui-focused fieldset": { borderColor: "#F4B942" },
                },
                "& .MuiInputLabel-root": { color: "#8892b0" },
                "& .MuiInputLabel-root.Mui-focused": { color: "#F4B942" },
              }}
            />
            <Button
              fullWidth
              variant="contained"
              onClick={connect}
              sx={{
                background: "linear-gradient(135deg, #F4B942 0%, #e6a830 100%)",
                color: "#010430",
                fontWeight: 700,
                fontSize: "1rem",
                padding: "12px",
                borderRadius: "10px",
                textTransform: "none",
                marginTop: "8px",
                "&:hover": { background: "#e6a830" },
              }}
            >
              Join Call
            </Button>
          </div>
        </div>
      ) : (
        /* ── Meeting room ── */
        <div className={styles.meetVideoContainer}>
          {/* LEFT: Chat panel — slides in, takes space */}
          {chatOpen && (
            <div className={styles.chatPanel}>
              <div className={styles.sidePanelHeader}>
                <span>Chat</span>
                <button className={styles.panelClose} onClick={toggleChat}>
                  ✕
                </button>
              </div>
              <div className={styles.chattingDisplay}>
                {messages.length === 0 ? (
                  <p className={styles.noMessages}>No messages yet</p>
                ) : (
                  messages.map((item, index) => (
                    <div
                      key={index}
                      className={`${styles.messageBubble} ${item.sender === username ? styles.myMessage : styles.theirMessage}`}
                    >
                      <span className={styles.messageSender}>
                        {item.sender}
                      </span>
                      <p className={styles.messageText}>{item.data}</p>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
              <div className={styles.chattingArea}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Message…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleMessageKey}
                  multiline
                  maxRows={4}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      color: "#e8eaf6",
                      background: "#0d1b3e",
                      "& fieldset": { borderColor: "#1e3a6e" },
                      "&:hover fieldset": { borderColor: "#F4B942" },
                      "&.Mui-focused fieldset": { borderColor: "#F4B942" },
                    },
                    "& .MuiInputBase-input::placeholder": { color: "#8892b0" },
                  }}
                />
                <p className={styles.chatHint}>
                  Enter to send · Shift+Enter for new line
                </p>
              </div>
            </div>
          )}

          {/* CENTER: Spotlight speaker */}
          <div className={styles.spotlightArea}>
            {/* Screen / Camera toggle pill — visible only when YOU are screen sharing */}
            {screen && (
              <div className={styles.viewToggle}>
                <button
                  className={`${styles.viewToggleBtn} ${screenView === "screen" ? styles.viewToggleActive : ""}`}
                  onClick={() => setScreenView("screen")}
                >
                  <ScreenShareIcon style={{ fontSize: "0.85rem" }} /> Screen
                </button>
                <button
                  className={`${styles.viewToggleBtn} ${screenView === "camera" ? styles.viewToggleActive : ""}`}
                  onClick={() => setScreenView("camera")}
                >
                  <VideocamIcon style={{ fontSize: "0.85rem" }} /> Camera
                </button>
              </div>
            )}

            {spotlightVideo ? (
              <div className={styles.spotlightCard}>
                <video
                  autoPlay
                  playsInline
                  ref={(ref) => {
                    if (ref && spotlightVideo.stream)
                      ref.srcObject = spotlightVideo.stream;
                  }}
                ></video>
                <div className={styles.spotlightLabel}>
                  {spotlightVideo.socketId.slice(0, 8)}
                </div>
              </div>
            ) : (
              /* No remote users yet — show local video large */
              <div className={styles.spotlightCard}>
                {/* When screen sharing: show screen or camera based on toggle */}
                {screen && screenView === "screen" ? (
                  <video
                    autoPlay
                    muted
                    ref={(ref) => {
                      if (ref && window.localStream)
                        ref.srcObject = window.localStream;
                    }}
                  ></video>
                ) : (
                  <video ref={localVideoref} autoPlay muted></video>
                )}
                <div className={styles.spotlightLabel}>{username || "You"}</div>
              </div>
            )}

            {/* PiP local video — only when a remote is spotlighted */}
            {spotlightVideo && (
              <div className={styles.pipWrapper}>
                <video
                  ref={localVideoref}
                  autoPlay
                  muted
                  className={styles.pipVideo}
                ></video>
                <div className={styles.pipLabel}>{username || "You"}</div>
              </div>
            )}
          </div>

          {/* RIGHT: Participants strip — always visible */}
          <div className={styles.participantStrip}>
            <div className={styles.stripHeader}>
              <PeopleIcon style={{ fontSize: "0.9rem", color: "#F4B942" }} />
              <span>{videos.length + 1} in call</span>
            </div>

            <div className={styles.stripList}>
              {/* Local user thumbnail — always first */}
              <div
                className={`${styles.stripCard} ${!spotlightVideo ? styles.stripCardActive : ""}`}
                onClick={() => setSpotlightId(null)}
              >
                <video
                  autoPlay
                  muted
                  ref={(ref) => {
                    // mirror local stream into strip thumbnail
                    if (ref && window.localStream)
                      ref.srcObject = window.localStream;
                  }}
                ></video>
                <div className={styles.stripLabel}>{username || "You"}</div>
              </div>

              {/* Remote thumbnails */}
              {videos.map((v) => (
                <div
                  key={v.socketId}
                  className={`${styles.stripCard} ${spotlightId === v.socketId ? styles.stripCardActive : ""}`}
                  onClick={() => setSpotlightId(v.socketId)}
                >
                  <video
                    autoPlay
                    playsInline
                    ref={(ref) => {
                      if (ref && v.stream) ref.srcObject = v.stream;
                    }}
                  ></video>
                  <div className={styles.stripLabel}>
                    {v.socketId.slice(0, 8)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* BOTTOM: Control bar */}
          <div className={styles.buttonContainers}>
            <div className={styles.controlBar}>
              <div className={styles.controlBtn}>
                <IconButton
                  onClick={handleVideo}
                  className={`${styles.iconBtn} ${!video ? styles.iconBtnOff : ""}`}
                >
                  {video ? <VideocamIcon /> : <VideocamOffIcon />}
                </IconButton>
                <span>{video ? "Camera" : "Off"}</span>
              </div>

              <div className={styles.controlBtn}>
                <IconButton
                  onClick={handleAudio}
                  className={`${styles.iconBtn} ${!audio ? styles.iconBtnOff : ""}`}
                >
                  {audio ? <MicIcon /> : <MicOffIcon />}
                </IconButton>
                <span>{audio ? "Mic" : "Muted"}</span>
              </div>

              {screenAvailable && (
                <div className={styles.controlBtn}>
                  <IconButton
                    onClick={handleScreen}
                    className={`${styles.iconBtn} ${screen ? styles.iconBtnActive : ""}`}
                  >
                    {screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                  </IconButton>
                  <span>{screen ? "Stop" : "Share"}</span>
                </div>
              )}

              <div className={styles.controlBtn}>
                <IconButton
                  onClick={handleEndCall}
                  className={styles.iconBtnEnd}
                >
                  <CallEndIcon />
                </IconButton>
                <span>Leave</span>
              </div>

              <div className={styles.controlBtn}>
                <Badge badgeContent={newMessages || null} color="warning">
                  <IconButton
                    onClick={toggleChat}
                    className={`${styles.iconBtn} ${chatOpen ? styles.iconBtnActive : ""}`}
                  >
                    <ChatIcon />
                  </IconButton>
                </Badge>
                <span>Chat</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoMeetComponent;
