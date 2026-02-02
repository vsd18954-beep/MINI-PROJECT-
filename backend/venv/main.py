import os
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai
from pathlib import Path
from pypdf import PdfReader # Tool to read PDFs

# --- 1. SETUP & CONFIG ---
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

api_key = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=api_key)

# Use the model that worked for you
model = genai.GenerativeModel('models/gemini-flash-latest')

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. MEMORY (The Simple RAG) ---
# This variable will store the text from your PDF
# In a big project, we use a Database. For now, this is faster/easier.
knowledge_base = "" 

class UserQuery(BaseModel):
    question: str

@app.get("/")
def read_root():
    return {"message": "AI Teacher Backend is Ready!"}

# --- 3. NEW ENDPOINT: UPLOAD PDF ---
@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    global knowledge_base
    
    # Read the uploaded file
    pdf_reader = PdfReader(file.file)
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text()
    
    # Store it in our "Brain"
    knowledge_base = text
    print(f"✅ PDF Uploaded! Extracted {len(text)} characters.")
    
    return {"message": "PDF processed successfully!", "length": len(text)}

# --- 4. UPDATED CHAT ENDPOINT ---
@app.post("/chat")
def chat_endpoint(query: UserQuery):
    global knowledge_base
    print(f"User asked: {query.question}")
    
    try:
        # RAG MAGIC HAPPENS HERE:
        # We combine the "Context" (PDF text) with the "Question"
        prompt = f"""
        You are a helpful teaching assistant. Answer the question based ONLY on the following context.
        
        CONTEXT (From the student's PDF):
        {knowledge_base[:30000]}  # (Limit to 30k chars to be safe)
        
        QUESTION: 
        {query.question}
        """
        
        response = model.generate_content(prompt)
        return {"answer": response.text}
        
    except Exception as e:
        return {"answer": f"Error: {str(e)}"}