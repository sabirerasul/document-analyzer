import os
from dotenv import load_dotenv

load_dotenv() # Load environment variables from .env

from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException, status
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List, Optional
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle, ListStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, Flowable
from fastapi.security import OAuth2PasswordRequestForm # Import this
import markdown
from bs4 import BeautifulSoup

from utils import extract_text_from_file, upload_file_to_s3, download_file_from_s3, delete_file_from_s3
from database import SessionLocal, engine, get_db
from models import Base, User, File, AIResponse
from auth import get_password_hash, verify_password, create_access_token, get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES
import google.generativeai as genai
from pydantic import BaseModel
from datetime import timedelta, datetime
from sqlalchemy import desc


app = FastAPI() # Move app initialization here

# Initialize database
Base.metadata.create_all(bind=engine)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

model = genai.GenerativeModel("gemini-2.5-flash")

# Mount static files for the frontend
app.mount("/static", StaticFiles(directory="frontend"), name="static")

@app.get("/")
async def read_index():
    return FileResponse('frontend/index.html')

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for development only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for API request/response
class UserCreate(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    id: int
    username: str

    class Config:
        orm_mode = True

class AIResponseModel(BaseModel):
    id: int
    response_text: str
    analysis_timestamp: datetime

    class Config:
        orm_mode = True

class FileResponseModel(BaseModel):
    id: int
    filename: str
    upload_timestamp: datetime
    s3_url: str
    ai_response: Optional[AIResponseModel]

    class Config:
        orm_mode = True

FileResponseModel.update_forward_refs()


@app.post("/register", response_model=UserResponse)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = get_password_hash(user.password)
    new_user = User(username=user.username, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/token", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/users/me/", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.post("/analyze", response_model=FileResponseModel)
async def analyze_file(
    file: UploadFile = File(),
    prompt: str = Form(...), 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    content = await file.read()
    filename = file.filename.lower()

    if filename.endswith((".pdf", ".jpg", ".jpeg", ".png", ".docx", ".csv", ".xlsx", "xls", ".txt")):
        extracted = extract_text_from_file(content, filename)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    # Upload to S3
    s3_url = upload_file_to_s3(content, filename, current_user.id)
    if not s3_url:
        raise HTTPException(status_code=500, detail="Failed to upload file to S3")

    # Store file metadata in DB
    db_file = File(filename=file.filename, s3_url=s3_url, owner_id=current_user.id)
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    full_prompt = f"{prompt}\n\n{extracted}"

    try:
        response = model.generate_content(full_prompt)
        ai_response_text = response.text

        # Store AI response in DB
        db_ai_response = AIResponse(file_id=db_file.id, response_text=ai_response_text)
        db.add(db_ai_response)
        db.commit()
        db.refresh(db_ai_response)

        db_file.ai_response = db_ai_response
        return db_file
    except Exception as e:
        db.delete(db_file) # Rollback file entry if AI analysis fails
        db.commit()
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {e}")

@app.get("/history", response_model=List[FileResponseModel])
def get_file_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # files = db.query(File).filter(File.owner_id == current_user.id).all()
    files = db.query(File).filter(File.owner_id == current_user.id).order_by(desc(File.upload_timestamp)).all()
    return files

@app.delete("/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(file_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_file = db.query(File).filter(File.id == file_id, File.owner_id == current_user.id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found or you don't have permission")

    # Delete from S3
    if not delete_file_from_s3(db_file.s3_url):
        # Log the error but proceed to delete from DB anyway, or handle as a more critical error
        print(f"Could not delete file from S3: {db_file.s3_url}. Continuing with DB deletion.")

    # Delete AI response if it exists
    if db_file.ai_response:
        db.delete(db_file.ai_response)
    
    # Delete file record from DB
    db.delete(db_file)
    db.commit()
    return

@app.get("/download/{file_id}/original")
async def download_original_file(file_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_file = db.query(File).filter(File.id == file_id, File.owner_id == current_user.id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found or you don't have permission")
    
    file_content = download_file_from_s3(db_file.s3_url)
    if not file_content:
        raise HTTPException(status_code=500, detail="Failed to download file from S3")
    
    return StreamingResponse(BytesIO(file_content), media_type="application/octet-stream", headers={"Content-Disposition": f"attachment; filename={db_file.filename}"})

@app.get("/download/{ai_response_id}/pdf")
async def download_ai_response_pdf(ai_response_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_ai_response = db.query(AIResponse).filter(AIResponse.id == ai_response_id).first()
    if not db_ai_response:
        raise HTTPException(status_code=404, detail="AI response not found")
    
    # Verify ownership
    db_file = db.query(File).filter(File.id == db_ai_response.file_id, File.owner_id == current_user.id).first()
    if not db_file:
        raise HTTPException(status_code=403, detail="You don't have permission to access this AI response")

    # Convert markdown to HTML preserving structure
    html = markdown.markdown(db_ai_response.response_text)
    soup = BeautifulSoup(html, "html.parser")
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    
    # Define all necessary styles
    for name, style in {
        "Heading1": ParagraphStyle(name="Heading1", fontSize=16, leading=18, spaceAfter=12),
        "Heading2": ParagraphStyle(name="Heading2", fontSize=14, leading=16, spaceAfter=10),
        "Heading3": ParagraphStyle(name="Heading3", fontSize=12, leading=14, spaceAfter=8),
        "Link": ParagraphStyle(name="Link", textColor='blue', underline=1),
        "Italic": ParagraphStyle(name="Italic", fontName='Times-Italic', leading=14),
        "Code": ParagraphStyle(name="Code", fontName='Courier', fontSize=10, leftIndent=20),
    }.items():
        if name not in styles:
            styles.add(style)

    for name in ["ListBullet", "ListNumber"]:
        if name not in styles:
            ls = ListStyle(name)
            ls.leftIndent, ls.bulletIndent, ls.spaceAfter = 20, 10, 5
            styles.add(ls)

    def html_to_flowables(html_content, styles):
        soup = BeautifulSoup(html_content, 'html.parser')
        flowables = []

        # Define a recursive function to process elements and their children
        def process_node(node):
            if isinstance(node, str):
                # If it's a string (text node), return it directly
                return node
            
            tag_name = node.name
            # Recursively process children and join their content
            children_contents = [process_node(child) for child in node.contents]
            flat = []
            for child in children_contents:
                if isinstance(child, list):
                    flat.extend(child)
                else:
                    flat.append(child)

            children_content = "".join(str(c) for c in flat if isinstance(c, str))

            if tag_name in ['h1', 'h2', 'h3']:
                style_name = f'Heading{tag_name[1]}'
                return Paragraph(children_content, styles[style_name])
            elif tag_name == 'p':
                return Paragraph(children_content, styles['Normal'])
            elif tag_name in ['strong', 'b']:
                return f"<b>{children_content}</b>"
            elif tag_name in ['em', 'i']:
                return f"<i>{children_content}</i>"
            elif tag_name == 'u':
                return f"<u>{children_content}</u>"
            elif tag_name == 'a':
                # Ensure href attribute exists
                href = node.get("href", "")
                return f'<link href="{href}">{children_content}</link>'
            elif tag_name == 'ul':
                # Process list items recursively
                items = [process_node(li) for li in node.find_all('li')]
                return ListFlowable([Paragraph(i if isinstance(i, str) else str(i), styles['Normal']) for i in items], bulletType='bullet', style=styles['ListBullet'])
            elif tag_name == 'ol':
                # Process list items recursively
                items = [process_node(li) for li in node.find_all('li')]
                return ListFlowable([Paragraph(i if isinstance(i, str) else str(i), styles['Normal']) for i in items], bulletType='1', style=styles['ListNumber'])
            elif tag_name == 'blockquote':
                # Apply italic style for blockquotes
                return Paragraph(children_content, styles['Italic'])
            elif tag_name in ['pre', 'code']:
                # Use a monospaced font for code blocks
                return Paragraph(children_content, styles['Code'])
            else:
                # For any other tags, just return their content
                return children_content

        # Process top-level elements
        for element in soup.find_all(True, recursive=False):
            flowable = process_node(element)
            if isinstance(flowable, list):
                flowables.extend(flowable)
            elif isinstance(flowable, Flowable):
                flowables.append(flowable)
            elif isinstance(flowable, str):
                # If it's a string, wrap it in a Paragraph
                flowables.append(Paragraph(flowable, styles['Normal']))
            
            # Add spacing after each top-level element
            flowables.append(Spacer(1, 12))
            
        return flowables

    story = html_to_flowables(html, styles)
    
    doc.build(story)
    buffer.seek(0)

    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=ai_analysis_{db_file.filename}.pdf"})

@app.get("/download/{ai_response_id}/txt")
async def download_ai_response_txt(ai_response_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_ai_response = db.query(AIResponse).filter(AIResponse.id == ai_response_id).first()
    if not db_ai_response:
        raise HTTPException(status_code=404, detail="AI response not found")

    # Verify ownership
    db_file = db.query(File).filter(File.id == db_ai_response.file_id, File.owner_id == current_user.id).first()
    if not db_file:
        raise HTTPException(status_code=403, detail="You don't have permission to access this AI response")

    # Convert markdown to plain text
    html = markdown.markdown(db_ai_response.response_text)
    soup = BeautifulSoup(html, "html.parser")
    plain_text = soup.get_text()

    return StreamingResponse(BytesIO(plain_text.encode('utf-8')), media_type="text/plain", headers={"Content-Disposition": f"attachment; filename=ai_analysis_{db_file.filename}.txt"})
