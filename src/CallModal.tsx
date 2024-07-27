import React from "react";

interface CallModalProps {
  onAccept: () => void;
  onReject: () => void;
}

const CallModal: React.FC<CallModalProps> = ({ onAccept, onReject }) => {
  return (
    <div style={modalStyle}>
      <h2>Incoming Call</h2>
      <button onClick={onAccept}>Accept</button>
      <button onClick={onReject}>Reject</button>
    </div>
  );
};

const modalStyle: React.CSSProperties = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  padding: "20px",
  backgroundColor: "white",
  border: "1px solid black",
  borderRadius: "10px",
};

export default CallModal;
