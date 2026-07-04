import { useState, useEffect } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
const EMOJIS = ["👍", "🔥", "❤️", "💪", "🎉", "⭐", "😊", "🙌"];

export default function TaskComments({ taskId, canComment = false }) {
  const [open, setOpen]         = useState(false);
  const [comments, setComments] = useState([]);
  const [text, setText]         = useState("");

  useEffect(() => {
    if (open) fetchComments();
  }, [open]);

  async function fetchComments() {
    try {
      const res = await axios.get(`${API}/tasks/${taskId}/comments`);
      setComments(res.data);
    } catch (e) {
      console.error(e);
    }
  }

  // Emoji fires immediately on click — no Send needed
  async function submitEmoji(emoji) {
    try {
      await axios.post(`${API}/tasks/${taskId}/comments`, { emoji, text: null });
      fetchComments();
    } catch (e) {
      console.error(e);
    }
  }

  // Text still uses the Send button
  async function submitText() {
    if (!text.trim()) return;
    try {
      await axios.post(`${API}/tasks/${taskId}/comments`, { emoji: null, text });
      setText("");
      fetchComments();
    } catch (e) {
      console.error(e);
    }
  }

  // Group emoji reactions into counts: { "👍": 2, "🔥": 1 }
  const emojiCounts = comments
    .filter(c => c.emoji)
    .reduce((acc, c) => {
      acc[c.emoji] = (acc[c.emoji] || 0) + 1;
      return acc;
    }, {});

  const textComments = comments.filter(c => c.text);

  return (
    <div className="task-comments">
      <button className="comments-toggle" onClick={() => setOpen(!open)}>
        💬 {open ? "Hide" : `Comments${comments.length ? ` (${comments.length})` : ""}`}
      </button>

      {open && (
        <div className="comments-drawer">

          {/* Stacked emoji reactions */}
          {Object.keys(emojiCounts).length > 0 && (
            <div className="emoji-reactions">
              {Object.entries(emojiCounts).map(([e, count]) => (
                <span key={e} className="emoji-reaction">
                  {e}{count > 1 ? ` ${count}` : ""}
                </span>
              ))}
            </div>
          )}

          {/* Text comments */}
          <div className="comments-list">
            {textComments.length === 0
              ? <p className="no-comments">No notes yet</p>
              : textComments.map(c => (
                  <div key={c.id} className="comment-item">
                    <span className="comment-text">{c.text}</span>
                  </div>
                ))
            }
          </div>

          {/* Input — only shown on buddy tasks */}
          {canComment && (
            <>
              <div className="emoji-row">
                {EMOJIS.map(e => (
                  <button
                    key={e}
                    className="emoji-btn"
                    onClick={() => submitEmoji(e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <div className="comment-input-row">
                <input
                  type="text"
                  maxLength={200}
                  placeholder="Leave a note..."
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submitText()}
                />
                <button onClick={submitText}>Send</button>
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
}