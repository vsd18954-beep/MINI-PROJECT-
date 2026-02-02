import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import './App.css'

function App() {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hello! I am your DataSense AI Tutor. Upload your project PDF and ask me anything! 🤖' }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Ref for the hidden file input
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle Upload via the Sidebar Button
  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Show temporary "Uploading..." message
    setMessages(prev => [...prev, { role: 'ai', text: '📂 Reading your document...' }]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post("http://127.0.0.1:8000/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      // Success Message
      setMessages(prev => [...prev, { role: 'ai', text: '✅ Document loaded successfully! Ask me questions about it.' }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', text: '❌ Error uploading file.' }]);
    }
  };

  // Send Message Logic
  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await axios.post("http://127.0.0.1:8000/chat", {
        question: userMessage.text
      });
      
      const aiMessage = { role: 'ai', text: response.data.answer };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', text: "❌ Connection Error." }]);
    } finally {
      setLoading(false);
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') sendMessage();
  }

  // Trigger the hidden file input click
  const triggerFileUpload = () => {
    fileInputRef.current.click();
  }

  return (
    <div className="app-container">
      {/* 1. SIDEBAR (Left Side) */}
      <div className="sidebar">
        <div className="logo">
          <span>⚛️</span> DataSense AI
        </div>
        
        <div className="nav-item">🏠 Dashboard</div>
        <div className="nav-item active">💬 Chat</div>
        <div className="nav-item">📚 Lessons</div>
        <div className="nav-item">⚙️ Settings</div>

        {/* Upload Button at Bottom of Sidebar */}
        <button className="upload-btn" onClick={triggerFileUpload}>
           📂 Upload PDF
        </button>
        {/* Hidden Input for File Upload */}
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden-input" 
          onChange={handleUpload} 
        />
      </div>

      {/* 2. MAIN CONTENT (Right Side) */}
      <div className="main-content">
        <div className="chat-header">
          <h2>Project: Predictive Modeling</h2>
        </div>

        <div className="chat-window">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role === 'user' ? 'user-message' : 'ai-message'}`}>
              {msg.text}
            </div>
          ))}
          {loading && <div className="message ai-message">Typing...</div>}
          <div ref={chatEndRef} />
        </div>

        <div className="input-area">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question about your data..."
            disabled={loading}
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
  )
}

export default App