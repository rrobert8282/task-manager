import { useState, useEffect } from "react";
import axios from "axios";

const API = "http://127.0.0.1:8000";

export default function Buddy() {
  const [buddy, setBuddy]           = useState(null);
  const [inviteCode, setInviteCode] = useState("");
  const [acceptInput, setAcceptInput] = useState("");
  const [message, setMessage]       = useState("");
  const [loading, setLoading]       = useState(true);

  useEffect(() => { fetchBuddy(); }, []);

  async function fetchBuddy() {
    try {
      const res = await axios.get(`${API}/buddy`);
      setBuddy(res.data.buddy);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function generateCode() {
    try {
      const res = await axios.post(`${API}/buddy/invite`);
      setInviteCode(res.data.code);
      setMessage("");
    } catch (e) {
      setMessage(e.response?.data?.detail || "Error generating code");
    }
  }

  async function acceptCode() {
    try {
      const res = await axios.post(`${API}/buddy/accept`, { code: acceptInput.trim() });
      setMessage(res.data.message);
      setAcceptInput("");
      fetchBuddy();
    } catch (e) {
      setMessage(e.response?.data?.detail || "Invalid or expired code");
    }
  }

  async function unlinkBuddy() {
    try {
      await axios.delete(`${API}/buddy`);
      setBuddy(null);
      setInviteCode("");
      setMessage("Buddy unlinked");
    } catch (e) {
      setMessage(e.response?.data?.detail || "Error unlinking");
    }
  }

  if (loading) return <p>Loading buddy info...</p>;

  return (
    <div className="buddy-panel">
      {buddy ? (
        <div className="buddy-linked">
          <p>Buddy: <strong>{buddy.username}</strong></p>
          <button onClick={unlinkBuddy} className="btn-danger">Unlink</button>
        </div>
      ) : (
        <div className="buddy-setup">
          {/* Generate side */}
          <div className="buddy-block">
            <p className="buddy-label">Invite a friend</p>
            <button onClick={generateCode}>Generate Code</button>
            {inviteCode && (
              <div className="invite-code-row">
                <code>{inviteCode}</code>
                <button onClick={() => navigator.clipboard.writeText(inviteCode)}>
                  Copy
                </button>
              </div>
            )}
          </div>

          {/* Accept side */}
          <div className="buddy-block">
            <p className="buddy-label">Have a code?</p>
            <input
              type="text"
              placeholder="Paste code here"
              value={acceptInput}
              onChange={e => setAcceptInput(e.target.value)}
            />
            <button onClick={acceptCode}>Link Up</button>
          </div>
        </div>
      )}
      {message && <p className="buddy-message">{message}</p>}
    </div>
  );
}