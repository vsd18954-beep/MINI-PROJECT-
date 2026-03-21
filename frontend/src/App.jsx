import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import './App.css'
import aiTeacherImg from './assets/ai_teacher.png'

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("chat"); 
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // AUTHENTICATION STATE
  const [user, setUser] = useState(localStorage.getItem("userName") || "");
  const [authMode, setAuthMode] = useState("login"); // 'login' or 'signup'
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");

  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  // FETCH DATABASE HISTORY ON LOAD
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await axios.get("http://127.0.0.1:8000/history");
        if (response.data.length > 0) {
          setMessages(response.data);
        } else {
          setMessages([
            { role: 'ai', text: 'Hello! I am your AI Teaching Assistant. Upload your project PDF and ask me anything! 🤖' }
          ]);
        }
      } catch (error) {
        console.error("Error fetching database history", error);
      }
    };
    fetchHistory();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab]);

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setMessages(prev => [...prev, { role: 'ai', text: '📂 Reading your document...' }]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post("http://127.0.0.1:8000/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessages(prev => [...prev, { role: 'ai', text: '✅ **Document loaded successfully!** Ask me questions about it.' }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', text: '❌ Error uploading file.' }]);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await axios.post("http://127.0.0.1:8000/chat", {
        question: userMessage.text,
        history: messages 
      });
      
      const aiMessage = { role: 'ai', text: response.data.answer };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', text: "❌ Connection Error." }]);
    } finally {
      setLoading(false);
    }
  }

  const startLiveLesson = async (topic) => {
    setIsSpeaking(true);
    try {
      const response = await axios.post("http://127.0.0.1:8000/chat", {
        question: `Answer this question: '${topic}' in exactly 2 short, simple sentences. Speak as if you are a friendly teacher talking to a student.`,
        history: [] 
      });
      
      const lessonText = response.data.answer;
      
      const audioResponse = await axios.post("http://127.0.0.1:8000/speak", {
        text: lessonText
      }, {
        responseType: 'blob' 
      });
      
      const audioUrl = URL.createObjectURL(audioResponse.data);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => setIsSpeaking(false); 
      audio.play();
    } catch (error) {
      console.error("Error during lesson:", error);
      setIsSpeaking(false);
    }
  }

  const resetChat = async () => {
    try {
      await axios.delete("http://127.0.0.1:8000/history");
    } catch (error) {
      console.error("Could not wipe database");
    }
    setMessages([
      { role: 'ai', text: 'Hello! I am your AI Teaching Assistant. Upload your project PDF and ask me anything! 🤖' }
    ]);
    setActiveTab("chat");
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') sendMessage();
  }

  const triggerFileUpload = () => {
    fileInputRef.current.click();
  }

  // AUTHENTICATION HANDLERS
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    
    const endpoint = authMode === "login" ? "/login" : "/signup";
    
    try {
      const response = await axios.post(`http://127.0.0.1:8000${endpoint}`, authForm);
      if (response.data.success) {
        setUser(response.data.name);
        localStorage.setItem("userName", response.data.name);
        setAuthForm({ name: "", email: "", password: "" });
        setActiveTab("chat");
      } else {
        setAuthError(response.data.error);
      }
    } catch (error) {
      setAuthError("Server error. Please try again.");
    }
  }

  const handleLogout = () => {
    setUser("");
    localStorage.removeItem("userName");
    setActiveTab("settings");
  }

  const userHistory = messages.filter(msg => msg.role === 'user');

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="logo">
          <span>🎓</span> AI Assistant
        </div>
        
        <div className="nav-item active-action" onClick={resetChat}>
           ➕ New Chat
        </div>

        <div className="divider"></div>

        <div className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>💬 Chat</div>
        <div className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>🕒 Chat History</div>
        <div className={`nav-item ${activeTab === 'lessons' ? 'active' : ''}`} onClick={() => setActiveTab('lessons')}>🎥 Live Lessons</div>
        <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>⚙️ Settings</div>
        
        <button className="upload-btn animate-pop" onClick={triggerFileUpload} style={{marginTop: 'auto'}}>📂 Upload PDF</button>
        <input type="file" ref={fileInputRef} className="hidden-input" onChange={handleUpload} />
      </div>

      <div className="main-content">
        <div className="chat-header">
          <h2>{user ? `👋 Welcome, ${user}!` : "Project: Predictive Modeling"}</h2>
        </div>

        {activeTab === 'chat' && (
          <>
            <div className="chat-window">
              {messages.map((msg, index) => (
                <div key={index} className={`message animate-fade-up ${msg.role === 'user' ? 'user-message' : 'ai-message'}`}>
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              ))}
              {loading && <div className="message ai-message animate-pulse">Typing...</div>}
              <div ref={chatEndRef} />
            </div>

            <div className="input-area">
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={handleKeyPress} placeholder="Ask a question about your data..." disabled={loading}/>
              <button onClick={sendMessage} className="animate-pop">Send</button>
            </div>
          </>
        )}

        {/* UPDATED HISTORY VIEW */}
        {activeTab === 'history' && (
          <div className="history-view animate-fade-up" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '10px', color: '#1f2937' }}>
              📝 Session History
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '20px' }}>
              These questions are permanently saved in your database:
            </p>
            
            {userHistory.length === 0 ? (
              <p style={{ fontStyle: 'italic', color: '#9ca3af' }}>No questions yet! Go to chat and ask something.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '25px' }}>
                {userHistory.map((msg, index) => (
                  <div 
                    key={index} 
                    className="topic-card animate-fade-up" 
                    style={{ animationDelay: `${index * 0.05}s`, cursor: 'text' }}
                  >
                    <strong style={{ color: '#2563eb' }}>Q{index + 1}:</strong> {msg.text}
                  </div>
                ))}
              </div>
            )}
            
            <button 
              className="auth-submit-btn animate-pop" 
              onClick={() => setActiveTab('chat')}
              style={{ padding: '10px 20px', width: 'auto' }}
            >
              ⬅️ Back to Chat
            </button>
          </div>
        )}

        {activeTab === 'lessons' && (
          <div className="lessons-view animate-fade-up">
            <div className="video-container">
              <div className="ai-video-feed">
                <div className="ai-facecam-wrapper">
                  <img src={aiTeacherImg} alt="AI Teacher" className={`ai-teacher-image ${isSpeaking ? 'speaking-glow' : ''}`} />
                </div>
                <p>{isSpeaking ? 'AI Teacher is speaking...' : 'AI Teacher is Ready'}</p>
                <span className="live-badge animate-pulse">🔴 LIVE</span>
              </div>
              <div className="video-controls">
                <button className="control-btn">🎤 Mute</button>
                <button className="control-btn">📷 Video</button>
                <button className="control-btn end-call">❌ End Class</button>
              </div>
            </div>

            <div className="lesson-topics">
              <h3>Select a Question to Start a Voice Lesson:</h3>
              {userHistory.length === 0 ? (
                <p style={{ color: '#666', fontStyle: 'italic', marginTop: '10px' }}>
                  No topics available yet. Go to the "💬 Chat" tab and ask some questions about your PDF first!
                </p>
              ) : (
                userHistory.map((msg, index) => (
                  <div key={index} className="topic-card animate-fade-up" style={{animationDelay: `${index * 0.1}s`}} onClick={() => startLiveLesson(msg.text)}>
                    🔊 {index + 1}. {msg.text}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-view animate-fade-up">
            {user ? (
              <div className="auth-card">
                <h3>Profile Settings</h3>
                <div className="profile-info">
                  <div className="avatar">{user.charAt(0).toUpperCase()}</div>
                  <div className="details">
                    <p><strong>Name:</strong> {user}</p>
                    <p><strong>Status:</strong> Logged In</p>
                  </div>
                </div>
                <button className="back-btn animate-pop" onClick={handleLogout} style={{backgroundColor: '#ef4444', marginTop: '20px'}}>
                  🚪 Sign Out
                </button>
              </div>
            ) : (
              <div className="auth-card">
                <h3>{authMode === 'login' ? 'Sign In' : 'Create an Account'}</h3>
                {authError && <div className="auth-error">{authError}</div>}
                
                <form onSubmit={handleAuthSubmit} className="auth-form">
                  {authMode === 'signup' && (
                    <input 
                      type="text" 
                      placeholder="Your Name" 
                      required 
                      value={authForm.name}
                      onChange={(e) => setAuthForm({...authForm, name: e.target.value})}
                    />
                  )}
                  <input 
                    type="email" 
                    placeholder="Email Address" 
                    required 
                    value={authForm.email}
                    onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                  />
                  <input 
                    type="password" 
                    placeholder="Password" 
                    required 
                    value={authForm.password}
                    onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                  />
                  <button type="submit" className="auth-submit-btn animate-pop">
                    {authMode === 'login' ? 'Sign In' : 'Sign Up'}
                  </button>
                </form>

                <p className="auth-toggle">
                  {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                  <span onClick={() => {setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError("");}}>
                    {authMode === 'login' ? 'Sign up here' : 'Sign in here'}
                  </span>
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

export default App