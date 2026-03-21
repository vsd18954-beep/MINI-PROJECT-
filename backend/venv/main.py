import os
import numpy as np
import sqlite3 
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai
from pathlib import Path
from pypdf import PdfReader
from io import BytesIO
from fastapi.responses import StreamingResponse
from gtts import gTTS

# --- 1. SETUP & CONFIG ---
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

api_key = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=api_key)

chat_model = genai.GenerativeModel('models/gemini-flash-latest')
embedding_model = 'models/gemini-embedding-001' 

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. DATABASE SETUP (SQLite) ---
def init_db():
    conn = sqlite3.connect('chat_history.db')
    c = conn.cursor()
    # Table for Chat
    c.execute('''CREATE TABLE IF NOT EXISTS messages
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  role TEXT,
                  text TEXT)''')
    # NEW: Table for Users
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  name TEXT,
                  email TEXT UNIQUE,
                  password TEXT)''')
    conn.commit()
    conn.close()

init_db() 

# --- 3. STATE & MODELS ---
document_chunks = []
document_embeddings = []

class UserQuery(BaseModel):
    question: str
    history: list = []

class SpeakQuery(BaseModel):
    text: str

# NEW: Auth Models
class AuthUser(BaseModel):
    name: str = ""
    email: str
    password: str

@app.get("/")
def read_root():
    return {"message": "True RAG Backend with SQLite Memory Running!"}

# --- NEW: AUTHENTICATION ENDPOINTS ---
@app.post("/signup")
def signup(user: AuthUser):
    conn = sqlite3.connect('chat_history.db')
    c = conn.cursor()
    try:
        c.execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", (user.name, user.email, user.password))
        conn.commit()
        return {"success": True, "name": user.name}
    except sqlite3.IntegrityError:
        return {"success": False, "error": "Email already exists!"}
    finally:
        conn.close()

@app.post("/login")
def login(user: AuthUser):
    conn = sqlite3.connect('chat_history.db')
    c = conn.cursor()
    c.execute("SELECT name FROM users WHERE email=? AND password=?", (user.email, user.password))
    row = c.fetchone()
    conn.close()
    
    if row:
        return {"success": True, "name": row[0]}
    return {"success": False, "error": "Invalid email or password!"}

# --- 4. DATABASE ENDPOINTS (CHAT) ---
@app.get("/history")
def get_history():
    conn = sqlite3.connect('chat_history.db')
    c = conn.cursor()
    c.execute("SELECT role, text FROM messages ORDER BY id ASC")
    rows = c.fetchall()
    conn.close()
    return [{"role": row[0], "text": row[1]} for row in rows]

@app.delete("/history")
def clear_history():
    conn = sqlite3.connect('chat_history.db')
    c = conn.cursor()
    c.execute("DELETE FROM messages")
    conn.commit()
    conn.close()
    return {"message": "Database wiped clean!"}

# --- 5. HELPER FUNCTIONS ---
def get_embedding(text):
    result = genai.embed_content(
        model=embedding_model,
        content=text,
        task_type="retrieval_document"
    )
    return result['embedding']

def cosine_similarity(vec1, vec2):
    dot_product = np.dot(vec1, vec2)
    norm_1 = np.linalg.norm(vec1)
    norm_2 = np.linalg.norm(vec2)
    if norm_1 == 0 or norm_2 == 0:
        return 0.0
    return dot_product / (norm_1 * norm_2)

# --- 6. CORE ENDPOINTS ---
@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    global document_chunks, document_embeddings
    document_chunks = []
    document_embeddings = []
    
    pdf_reader = PdfReader(file.file)
    full_text = ""
    for page in pdf_reader.pages:
        full_text += page.extract_text() or ""
        
    chunk_size = 1000
    for i in range(0, len(full_text), chunk_size):
        document_chunks.append(full_text[i:i+chunk_size])
        
    for chunk in document_chunks:
        document_embeddings.append(get_embedding(chunk))
        
    return {"message": f"Processed {len(document_chunks)} chunks."}

@app.post("/chat")
def chat_endpoint(query: UserQuery):
    global document_chunks, document_embeddings
    conn = sqlite3.connect('chat_history.db')
    c = conn.cursor()
    c.execute("INSERT INTO messages (role, text) VALUES (?, ?)", ("user", query.question))
    conn.commit()

    try:
        if not document_chunks:
            ai_answer = "Please upload a document first!"
        else:
            question_vector = get_embedding(query.question)
            similarities = [cosine_similarity(question_vector, doc_vec) for doc_vec in document_embeddings]
            top_3_indices = np.argsort(similarities)[-3:][::-1]
            best_context = "\n\n".join([document_chunks[i] for i in top_3_indices])

            chat_history_text = ""
            for msg in query.history[-4:]: 
                role = msg.get("role", "user")
                content = msg.get("text", "")
                chat_history_text += f"{role.upper()}: {content}\n"

            prompt = f"""
            You are an AI Teaching Assistant. Answer based ONLY on the context below.
            CONTEXT: {best_context}
            HISTORY: {chat_history_text}
            QUESTION: {query.question}
            """
            
            response = chat_model.generate_content(prompt)
            ai_answer = response.text

        c.execute("INSERT INTO messages (role, text) VALUES (?, ?)", ("ai", ai_answer))
        conn.commit()
        conn.close()

        return {"answer": ai_answer}
        
    except Exception as e:
        conn.close()
        return {"answer": f"Error: {str(e)}"}

@app.post("/speak")
def speak_endpoint(query: SpeakQuery):
    try:
        tts = gTTS(text=query.text, lang='en', tld='us')
        mp3_fp = BytesIO()
        tts.write_to_fp(mp3_fp)
        mp3_fp.seek(0)
        return StreamingResponse(mp3_fp, media_type="audio/mpeg")
    except Exception as e:
        return {"error": f"Failed to generate audio: {str(e)}"}