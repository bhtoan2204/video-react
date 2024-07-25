// src/components/VideoCall.tsx
import React, { useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext";

interface CallData {
  userId: string;
  roomId: string;
}

const VideoCall: React.FC = () => {
  const { socket } = useSocket();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [peerConnection, setPeerConnection] =
    useState<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (!socket) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    setPeerConnection(pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("iceCandidate", {
          roomId: "roomId", // Replace with the actual roomId
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    socket.on("offer", async (data) => {
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { roomId: data.roomId, answer });
    });

    socket.on("answer", async (data) => {
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    });

    socket.on("iceCandidate", async (data) => {
      if (!pc) return;
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    });

    return () => {
      pc.close();
      setPeerConnection(null);
    };
  }, [socket]);

  const startCall = async () => {
    if (!socket || !peerConnection) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    stream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, stream);
    });

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit("offer", {
      roomId: "roomId", // Replace with the actual roomId
      offer,
    });
  };

  return (
    <div>
      <div>
        <video ref={localVideoRef} autoPlay muted />
        <video ref={remoteVideoRef} autoPlay />
      </div>
      <button onClick={startCall}>Start Call</button>
    </div>
  );
};

export default VideoCall;
