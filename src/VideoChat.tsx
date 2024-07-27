// src/VideoCall.tsx
import React, { useState, useEffect, useRef } from "react";
import Peer from "peerjs";

interface Participant {
  peerId: string;
  stream: MediaStream;
}

const VideoCall: React.FC = () => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [myPeerId, setMyPeerId] = useState<string>("");
  const [remotePeerId, setRemotePeerId] = useState<string>("");
  const [participants, setParticipants] = useState<Participant[]>([]);

  const myVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!myPeerId) return;

    const peerInstance = new Peer(myPeerId, {
      host: "192.168.0.110",
      port: 8080,
      path: "/peerjs",
      key: "famfund",
    });

    setPeer(peerInstance);

    peerInstance.on("open", (id) => {
      console.log(`My peer ID is: ${id}`);
    });

    peerInstance.on("call", async (incomingCall) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (myVideoRef.current) {
          myVideoRef.current.srcObject = stream;
          myVideoRef.current.play().catch((error) => {
            console.error("Error playing video:", error);
          });
        }
        incomingCall.answer(stream);
        incomingCall.on("stream", (remoteStream) => {
          addParticipant(incomingCall.peer, remoteStream);
        });
      } catch (error) {
        console.error("Error accessing media devices:", error);
      }
    });

    peerInstance.on("error", (err) => {
      console.error("PeerJS error:", err);
    });

    return () => {
      peerInstance.destroy();
    };
  }, [myPeerId]);

  const addParticipant = (peerId: string, stream: MediaStream) => {
    setParticipants((prevParticipants) => [
      ...prevParticipants,
      { peerId, stream },
    ]);
  };

  const startCall = async () => {
    if (!peer) {
      console.error("Peer instance is not available.");
      return;
    }
    if (!remotePeerId) {
      console.error("Remote Peer ID is not set.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream;
        myVideoRef.current.play().catch((error) => {
          console.error("Error playing video:", error);
        });
      }
      const outgoingCall = peer.call(remotePeerId, stream);
      outgoingCall.on("stream", (remoteStream) => {
        addParticipant(outgoingCall.peer, remoteStream);
      });
    } catch (error) {
      console.error("Error accessing media devices:", error);
    }
  };

  return (
    <div>
      <h1>Video Call</h1>
      <div>
        <label>Your ID: </label>
        <input
          type="text"
          value={myPeerId}
          onChange={(e) => setMyPeerId(e.target.value)}
          placeholder="Enter your unique ID"
        />
      </div>
      <div>
        <label>Remote ID: </label>
        <input
          type="text"
          value={remotePeerId}
          onChange={(e) => setRemotePeerId(e.target.value)}
          placeholder="Enter remote peer ID"
        />
        <button onClick={startCall}>Call</button>
      </div>
      <div>
        <video ref={myVideoRef} muted autoPlay playsInline />
        {participants.map((participant) => (
          <div key={participant.peerId}>
            <h3>{participant.peerId}</h3>
            <video
              ref={(ref) => {
                if (ref) {
                  ref.srcObject = participant.stream;
                  ref.play().catch((error) => {
                    console.error("Error playing remote video:", error);
                  });
                }
              }}
              autoPlay
              playsInline
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default VideoCall;
