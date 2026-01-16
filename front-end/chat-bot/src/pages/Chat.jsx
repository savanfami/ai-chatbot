import React, { useEffect, useState, useRef } from "react";
import axios from "axios";

const AI_USER = {
  id: "bot",
  displayName: "AI Assistant 🤖",
  isSystem: true,
};

export const Chat = ({ currentUser, socket }) => {
  const [users, setUsers] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState({});
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeUser]);

  useEffect(() => {
    const fetchUsers = async () => {
      const res = await axios.get("http://localhost:3001/users");
      const otherUsers = res.data.filter((u) => u.id !== currentUser.id);
      setUsers([...otherUsers, AI_USER]);
    };
    fetchUsers();

    socket.on("message", (msg) => {
      setMessages((prev) => ({
        ...prev,
        [msg.from]: [...(prev[msg.from] || []), msg],
      }));
      setIsTyping(false);
    });

    socket.on("ai_chunk", (chunk) => {
      setIsTyping(true);
      setMessages((prev) => {
        const last = prev["bot"]?.[prev["bot"].length - 1];

        if (last && !last.final) {
          const updated = {
            ...last,
            content: last.content + chunk,
          };
          return {
            ...prev,
            bot: [...prev["bot"].slice(0, -1), updated],
          };
        }

        return {
          ...prev,
          bot: [
            ...(prev["bot"] || []),
            { from: "bot", content: chunk, final: false },
          ],
        };
      });
      setTimeout(() => setIsTyping(false), 1000);
    });

    return () => {
      socket.off("message");
      socket.off("ai_chunk");
    };
  }, []);

  const sendMessage = () => {
    if (!activeUser || !message.trim()) return;

    const msg = {
      from: currentUser.id,
      to: activeUser.id,
      content: message,
    };

    socket.emit("message", msg);

    setMessages((prev) => ({
      ...prev,
      [activeUser.id]: [...(prev[activeUser.id] || []), msg],
    }));

    setMessage("");
  };

  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (id) => {
    const colors = [
      "#667eea", "#f56565", "#48bb78", "#ed8936", 
      "#9f7aea", "#38b2ac", "#ed64a6", "#4299e1"
    ];
    const index = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  return (
    <div style={styles.page}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.currentUserAvatar}>
            <div 
              style={{
                ...styles.avatarCircle,
                background: getAvatarColor(currentUser.id)
              }}
            >
              {getInitials(currentUser.displayName)}
            </div>
            <div style={styles.currentUserInfo}>
              <div style={styles.currentUserName}>{currentUser.displayName}</div>
              <div style={styles.onlineStatus}>
                <span style={styles.onlineDot}></span>
                Online
              </div>
            </div>
          </div>
        </div>

        <h3 style={styles.sidebarTitle}>Messages</h3>
        <div style={styles.usersList}>
          {users.map((u) => {
            const isActive = activeUser?.id === u.id;
            const hasMessages = messages[u.id]?.length > 0;
            const lastMessage = hasMessages 
              ? messages[u.id][messages[u.id].length - 1].content.slice(0, 40) + "..."
              : "Start a conversation";

            return (
              <div
                key={u.id}
                onClick={() => setActiveUser(u)}
                style={{
                  ...styles.userItem,
                  background: isActive ? "#eef2ff" : "transparent",
                  borderLeft: isActive ? "3px solid #667eea" : "3px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "#f9fafb";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "transparent";
                }}
              >
                <div 
                  style={{
                    ...styles.userAvatar,
                    background: u.id === "bot" ? "linear-gradient(135deg, #667eea, #764ba2)" : getAvatarColor(u.id)
                  }}
                >
                  {u.id === "bot" ? "🤖" : getInitials(u.displayName)}
                </div>
                <div style={styles.userInfo}>
                  <div style={styles.userName}>{u.displayName}</div>
                  <div style={styles.userPreview}>{lastMessage}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat */}
      <div style={styles.chat}>
        {activeUser ? (
          <>
            <div style={styles.header}>
              <div style={styles.headerContent}>
                <div 
                  style={{
                    ...styles.headerAvatar,
                    background: activeUser.id === "bot" 
                      ? "linear-gradient(135deg, #667eea, #764ba2)" 
                      : getAvatarColor(activeUser.id)
                  }}
                >
                  {activeUser.id === "bot" ? "🤖" : getInitials(activeUser.displayName)}
                </div>
                <div>
                  <div style={styles.headerName}>{activeUser.displayName}</div>
                  <div style={styles.headerStatus}>
                    {isTyping && activeUser.id === "bot" ? (
                      <>
                        <span style={styles.typingDot}></span>
                        typing...
                      </>
                    ) : (
                      "Active now"
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.messages}>
              {(messages[activeUser.id] || []).map((m, i) => {
                const isMe = m.from === currentUser.id;
                const isBotGenerated = m.generatedBy === "bot";

                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isMe ? "flex-end" : "flex-start",
                      animation: "slideIn 0.3s ease",
                    }}
                  >
                    {isBotGenerated && (
                      <div style={styles.botLabel}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{marginRight: 4}}>
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                        Generated by AI
                      </div>
                    )}

                    <div style={{display: "flex", alignItems: "flex-end", gap: 8, maxWidth: "75%"}}>
                      {!isMe && (
                        <div 
                          style={{
                            ...styles.messageAvatar,
                            background: activeUser.id === "bot" 
                              ? "linear-gradient(135deg, #667eea, #764ba2)" 
                              : getAvatarColor(activeUser.id)
                          }}
                        >
                          {activeUser.id === "bot" ? "🤖" : getInitials(activeUser.displayName)}
                        </div>
                      )}
                      <div
                        style={{
                          ...styles.message,
                          background: isMe 
                            ? "linear-gradient(135deg, #667eea, #764ba2)" 
                            : "#ffffff",
                          color: isMe ? "#fff" : "#1f2937",
                          borderRadius: isMe 
                            ? "18px 18px 4px 18px"
                            : "18px 18px 18px 4px",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                        }}
                      >
                        {m.content}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div style={styles.inputBar}>
              <input
                style={styles.input}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <button 
                style={{
                  ...styles.sendBtn,
                  opacity: message.trim() ? 1 : 0.5,
                }}
                onClick={sendMessage}
                disabled={!message.trim()}
                onMouseEnter={(e) => {
                  if (message.trim()) {
                    e.target.style.transform = "scale(1.05)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = "scale(1)";
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </>
        ) : (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>💬</div>
            <div style={styles.emptyTitle}>Select a conversation</div>
            <div style={styles.emptySubtitle}>
              Choose a contact from the sidebar to start chatting
            </div>
          </div>
        )}
      </div>

      {/* Add animations */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes typing {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

const styles = {
  page: {
    height: "100vh",
    display: "flex",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    background: "#f3f4f6",
  },
  sidebar: {
    width: 320,
    background: "#ffffff",
    borderRight: "1px solid #e5e7eb",
    display: "flex",
    flexDirection: "column",
    boxShadow: "2px 0 8px rgba(0,0,0,0.04)",
  },
  sidebarHeader: {
    padding: 20,
    borderBottom: "1px solid #e5e7eb",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  },
  currentUserAvatar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 600,
    fontSize: 16,
    border: "3px solid rgba(255,255,255,0.3)",
  },
  currentUserInfo: {
    flex: 1,
  },
  currentUserName: {
    fontSize: 16,
    fontWeight: 600,
    color: "#fff",
    marginBottom: 4,
  },
  onlineStatus: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#48bb78",
    boxShadow: "0 0 8px rgba(72,187,120,0.6)",
    animation: "pulse 2s ease-in-out infinite",
  },
  sidebarTitle: {
    padding: "16px 20px 12px",
    fontSize: 14,
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    margin: 0,
  },
  usersList: {
    flex: 1,
    overflowY: "auto",
    padding: "0 8px",
  },
  userItem: {
    padding: "12px 12px",
    borderRadius: 12,
    cursor: "pointer",
    marginBottom: 4,
    display: "flex",
    alignItems: "center",
    gap: 12,
    transition: "all 0.2s ease",
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 600,
    fontSize: 14,
    flexShrink: 0,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 15,
    fontWeight: 600,
    color: "#1f2937",
    marginBottom: 2,
  },
  userPreview: {
    fontSize: 13,
    color: "#9ca3af",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  chat: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: "#f9fafb",
  },
  header: {
    padding: 16,
    background: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  headerContent: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 600,
    fontSize: 14,
  },
  headerName: {
    fontSize: 16,
    fontWeight: 600,
    color: "#1f2937",
  },
  headerStatus: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#667eea",
    animation: "typing 1.4s ease-in-out infinite",
  },
  messages: {
    flex: 1,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    overflowY: "auto",
    background: "linear-gradient(to bottom, #f9fafb 0%, #ffffff 100%)",
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 600,
    fontSize: 12,
    flexShrink: 0,
  },
  message: {
    padding: "12px 16px",
    fontSize: 14,
    whiteSpace: "pre-wrap",
    lineHeight: 1.5,
    wordWrap: "break-word",
  },
  botLabel: {
    fontSize: 11,
    marginBottom: 6,
    color: "#667eea",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  inputBar: {
    padding: 16,
    display: "flex",
    gap: 12,
    background: "#ffffff",
    borderTop: "1px solid #e5e7eb",
    boxShadow: "0 -1px 3px rgba(0,0,0,0.04)",
  },
  input: {
    flex: 1,
    padding: "12px 16px",
    borderRadius: 24,
    border: "2px solid #e5e7eb",
    outline: "none",
    fontSize: 14,
    transition: "all 0.2s ease",
    background: "#f9fafb",
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    border: "none",
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
    transition: "all 0.2s ease",
  },
  empty: {
    margin: "auto",
    textAlign: "center",
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: "#1f2937",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#9ca3af",
  },
};