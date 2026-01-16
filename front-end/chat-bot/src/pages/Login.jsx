import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

export const Login = ({ setCurrentUser, setSocket }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [focusedField, setFocusedField] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!username || !password) return alert("Enter username/password");

    try {
      const res = await fetch("http://localhost:3001/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) return alert(data.message);

      const newSocket = io("http://localhost:3001");
      newSocket.emit("join", data.user.id);

      setCurrentUser(data.user);
      setSocket(newSocket);
      navigate("/chat");
    } catch (err) {
      alert("Network error");
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.backgroundShapes}>
        <div style={styles.shape1}></div>
        <div style={styles.shape2}></div>
        <div style={styles.shape3}></div>
      </div>

      <div style={styles.card}>
        <div style={styles.iconWrapper}>
          <div style={styles.icon}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </div>

        <h2 style={styles.title}>Welcome Back</h2>
        <p style={styles.subtitle}>Sign in to continue to your account</p>

        <div style={styles.inputWrapper}>
          <input
            style={{
              ...styles.input,
              ...(focusedField === "username" ? styles.inputFocused : {}),
            }}
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onFocus={() => setFocusedField("username")}
            onBlur={() => setFocusedField(null)}
          />
        </div>

        <div style={styles.inputWrapper}>
          <input
            style={{
              ...styles.input,
              ...(focusedField === "password" ? styles.inputFocused : {}),
            }}
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocusedField("password")}
            onBlur={() => setFocusedField(null)}
          />
        </div>

        <button
          style={styles.button}
          onClick={handleLogin}
          onMouseEnter={(e) => {
            e.target.style.transform = "translateY(-2px)";
            e.target.style.boxShadow = "0 8px 20px rgba(102, 126, 234, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = "translateY(0)";
            e.target.style.boxShadow = "0 4px 12px rgba(102, 126, 234, 0.3)";
          }}
        >
          Sign In
        </button>
      </div>
    </div>
  );
};

const styles = {
  page: {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  backgroundShapes: {
    position: "absolute",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    zIndex: 0,
  },
  shape1: {
    position: "absolute",
    width: "400px",
    height: "400px",
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.08)",
    top: "-100px",
    right: "-100px",
    animation: "float 6s ease-in-out infinite",
  },
  shape2: {
    position: "absolute",
    width: "300px",
    height: "300px",
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.06)",
    bottom: "-80px",
    left: "-80px",
    animation: "float 8s ease-in-out infinite 1s",
  },
  shape3: {
    position: "absolute",
    width: "200px",
    height: "200px",
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.05)",
    top: "50%",
    left: "10%",
    animation: "float 7s ease-in-out infinite 2s",
  },
  card: {
    width: "400px",
    padding: "48px 40px",
    borderRadius: "20px",
    background: "rgba(255, 255, 255, 0.98)",
    backdropFilter: "blur(10px)",
    boxShadow:
      "0 30px 60px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.3)",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    position: "relative",
    zIndex: 1,
  },
  iconWrapper: {
    display: "flex",
    justifyContent: "center",
    marginBottom: "8px",
  },
  icon: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    boxShadow: "0 8px 20px rgba(102, 126, 234, 0.3)",
  },
  title: {
    margin: 0,
    textAlign: "center",
    fontSize: "28px",
    fontWeight: 700,
    color: "#1a1a1a",
    letterSpacing: "-0.5px",
  },
  subtitle: {
    margin: "-8px 0 8px 0",
    textAlign: "center",
    fontSize: "14px",
    color: "#666",
    fontWeight: 400,
  },
  inputWrapper: {
    position: "relative",
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    fontSize: "15px",
    borderRadius: "10px",
    border: "2px solid #e8e8e8",
    outline: "none",
    boxSizing: "border-box",
    transition: "all 0.3s ease",
    background: "#fafafa",
    fontFamily: "inherit",
  },
  inputFocused: {
    border: "2px solid #667eea",
    background: "#fff",
    boxShadow: "0 0 0 4px rgba(102, 126, 234, 0.1)",
  },
  button: {
    marginTop: "12px",
    padding: "14px",
    borderRadius: "10px",
    border: "none",
    fontSize: "16px",
    fontWeight: 600,
    color: "#fff",
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
    fontFamily: "inherit",
  },
  footer: {
    textAlign: "center",
    marginTop: "8px",
  },
  link: {
    fontSize: "14px",
    color: "#667eea",
    textDecoration: "none",
    fontWeight: 500,
    transition: "color 0.3s ease",
  },
};

// Add keyframe animation via inline style tag
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-20px) rotate(5deg); }
  }
  
  a:hover {
    color: #764ba2 !important;
  }
`;
document.head.appendChild(styleSheet);
