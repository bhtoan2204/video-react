import React, { useEffect, useRef, useState } from "react";
import { Button, Form, Input, Modal, notification } from "antd";
import io from "socket.io-client";

const socketUrl = "http://localhost:8080/chat";
let socket: any | null = null;

const initializeSocket = (token: string) => {
  socket = io(socketUrl, {
    auth: { authorization: `Bearer ${token}` },
  });
};

const VideoChat: React.FC = () => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const [token, setToken] = useState<string>("");
  const [roomId, setRoomId] = useState<string>("");
  const [inRoom, setInRoom] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [callUserId, setCallUserId] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const createPeerConnection = () => {
    peerConnection.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("iceCandidate", { roomId, candidate: event.candidate });
      }
    };

    peerConnection.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    const localStream = localVideoRef.current?.srcObject as MediaStream;
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        const senderExists = peerConnection.current
          ?.getSenders()
          .some((sender) => sender.track?.kind === track.kind);
        if (!senderExists) {
          peerConnection.current!.addTrack(track, localStream);
        }
      });
    }
  };

  useEffect(() => {
    if (!isConnected) return;

    initializeSocket(token);

    socket.on("offer", async ({ clientId, offer, user }: any) => {
      if (!peerConnection.current) {
        createPeerConnection();
      }
      try {
        if (offer && peerConnection.current!.signalingState === "stable") {
          await peerConnection.current!.setRemoteDescription(
            new RTCSessionDescription(offer)
          );
          const answer = await peerConnection.current!.createAnswer();
          await peerConnection.current!.setLocalDescription(answer);
          socket.emit("answer", { roomId, answer });
        }
      } catch (error) {
        console.error("Error handling offer: ", error);
      }
    });

    socket.on("answer", async ({ clientId, answer, user }: any) => {
      if (!peerConnection.current) {
        createPeerConnection();
      }
      try {
        if (
          answer &&
          peerConnection.current!.signalingState === "have-local-offer"
        ) {
          await peerConnection.current!.setRemoteDescription(
            new RTCSessionDescription(answer)
          );
        }
      } catch (error) {
        console.error("Error handling answer: ", error);
      }
    });

    socket.on("iceCandidate", async ({ clientId, candidate, user }: any) => {
      try {
        if (candidate) {
          await peerConnection.current?.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        }
      } catch (error) {
        console.error("Error handling ICE candidate: ", error);
      }
    });

    socket.on("userJoined", ({ client_id, user }: any) => {
      // console.log(`User joined: ${user.id_user}`);
    });

    socket.on("userLeft", ({ clientId, user }: any) => {
      // console.log(`User left: ${user.id_user}`);
    });

    socket.on(
      "incomingCall",
      ({ from, roomId }: { from: any; roomId: string }) => {
        setIncomingCall({ from, roomId });
        setIsModalOpen(true);
      }
    );

    socket.on(
      "incomingFamilyCall",
      ({ from, roomId }: { from: string; roomId: string }) => {
        setIncomingCall({ from, roomId });
        setIsModalOpen(true);
      }
    );

    socket.on(
      "callAccepted",
      ({ clientId, user }: { clientId: string; user: any }) => {
        setRoomId(roomId);
        setInRoom(true);
        startLocalVideo();
      }
    );

    socket.on(
      "callRejected",
      ({ from, roomId }: { from: any; roomId: string }) => {
        notification.error({
          message: `User ${from.id_user} rejected your call.`,
        });
      }
    );

    return () => {
      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
    };
  }, [isConnected, token, roomId]);

  const startLocalVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      createPeerConnection();
      stream.getTracks().forEach((track) => {
        const senderExists = peerConnection.current
          ?.getSenders()
          .some((sender) => sender.track?.kind === track.kind);
        if (!senderExists) {
          peerConnection.current!.addTrack(track, stream);
        }
      });
    } catch (error) {
      console.error("Error starting local video: ", error);
    }
  };

  const handleJoinRoom = async () => {
    try {
      socket.emit("joinRoom", roomId);
      setInRoom(true);
      startLocalVideo();
    } catch (error) {
      console.error("Error joining room: ", error);
    }
  };

  const handleLeaveRoom = () => {
    try {
      socket.emit("leaveRoom", roomId);
      setInRoom(false);
      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
    } catch (error) {
      console.error("Error leaving room: ", error);
    }
  };

  const handleStartCall = async () => {
    try {
      if (callUserId) {
        if (!peerConnection.current) {
          createPeerConnection();
        }
        socket.emit("callUser", { userId: callUserId, roomId });
        const offer = await peerConnection.current?.createOffer();
        await peerConnection.current?.setLocalDescription(offer);
        socket.emit("offer", {
          roomId: roomId,
          offer,
        });
      }
    } catch (error) {
      console.error("Error starting call: ", error);
    }
  };

  const handleCallFamily = async (familyId: number) => {
    try {
      if (!peerConnection.current) {
        createPeerConnection();
      }
      socket.emit("callFamily", { familyId, roomId });
    } catch (error) {
      console.error("Error calling family: ", error);
    }
  };

  const handleAcceptCall = () => {
    if (incomingCall) {
      socket.emit("acceptCall", incomingCall.roomId);
      setIncomingCall(null);
      setIsModalOpen(false);
    }
  };

  const handleRejectCall = () => {
    if (incomingCall) {
      socket.emit("rejectCall", {
        callerId: incomingCall.from.id_user,
        roomId: incomingCall.roomId,
      });
      setIncomingCall(null);
      setIsModalOpen(false);
    }
  };

  const handleConnect = () => {
    initializeSocket(token);
    setIsConnected(true);
  };

  const handleDisconnect = () => {
    if (isConnected) {
      setIsConnected(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Video Chat</h2>
      <Form layout="vertical">
        <Form.Item label="Token">
          <Input value={token} onChange={(e) => setToken(e.target.value)} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" onClick={handleConnect} disabled={isConnected}>
            Connect
          </Button>
          <Button
            type="default"
            onClick={handleDisconnect}
            disabled={!isConnected}
            style={{ marginLeft: "10px" }}
          >
            Disconnect
          </Button>
        </Form.Item>
        <Form.Item label="Room ID">
          <Input value={roomId} onChange={(e) => setRoomId(e.target.value)} />
        </Form.Item>
        <Form.Item>
          <Button
            type="primary"
            onClick={handleJoinRoom}
            disabled={!isConnected || inRoom}
          >
            Join Room
          </Button>
          <Button
            type="default"
            onClick={handleLeaveRoom}
            disabled={!isConnected || !inRoom}
            style={{ marginLeft: "10px" }}
          >
            Leave Room
          </Button>
        </Form.Item>
        <Form.Item label="Call User ID">
          <Input
            value={callUserId}
            onChange={(e) => setCallUserId(e.target.value)}
          />
        </Form.Item>
        <Form.Item>
          <Button
            type="primary"
            onClick={handleStartCall}
            disabled={!isConnected || !inRoom || !callUserId}
          >
            Start Call
          </Button>
        </Form.Item>
        <Form.Item>
          <Button
            type="primary"
            onClick={() => handleCallFamily(1)}
            disabled={!isConnected || !inRoom}
          >
            Call Family 1
          </Button>
        </Form.Item>
      </Form>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "20px",
        }}
      >
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          style={{ width: "45%" }}
        />
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{ width: "45%" }}
        />
      </div>
      <Modal
        title="Incoming Call"
        visible={isModalOpen}
        onOk={handleAcceptCall}
        onCancel={handleRejectCall}
        okText="Accept"
        cancelText="Reject"
      >
        <p>{incomingCall && `Call from ${incomingCall.from.id_user}`}</p>
      </Modal>
    </div>
  );
};

export default VideoChat;
