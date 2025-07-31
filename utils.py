import mimetypes
import fitz  # for PDFs
import pytesseract
from PIL import Image
from docx import Document
import pandas as pd
from io import BytesIO
import boto3
import os

# AWS S3 Configuration
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")

# Ensure all S3 environment variables are loaded
if not all([AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME]):
    raise ValueError("AWS S3 environment variables not set. Please check your .env file.")

s3_client = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION
)

def upload_file_to_s3(file_content: bytes, filename: str, user_id: int):
    try:
        s3_key = f"uploads/{user_id}/{filename}"
        s3_client.put_object(Bucket=S3_BUCKET_NAME, Key=s3_key, Body=file_content)
        s3_url = f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"
        return s3_url
    except Exception as e:
        print(f"Error uploading file to S3: {e}")
        return None

def download_file_from_s3(s3_url: str):
    try:
        bucket_name = s3_url.split(".s3.")[0].replace("https://", "")
        key = "/".join(s3_url.split(".s3.")[1].split("/")[1:])
        response = s3_client.get_object(Bucket=bucket_name, Key=key)
        return response['Body'].read()
    except Exception as e:
        print(f"Error downloading file from S3: {e}")
        return None

def delete_file_from_s3(s3_url: str):
    try:
        bucket_name = s3_url.split(".s3.")[0].replace("https://", "")
        key = "/".join(s3_url.split(".s3.")[1].split("/")[1:])
        s3_client.delete_object(Bucket=bucket_name, Key=key)
        return True
    except Exception as e:
        print(f"Error deleting file from S3: {e}")
        return False


def extract_text_from_file(file: bytes, filename: str) -> str:
    file_ext = filename.split('.')[-1].lower()

    if file_ext == "pdf":
        doc = fitz.open(stream=file, filetype="pdf")
        return "\n".join([page.get_text() for page in doc])

    elif file_ext in ["jpg", "jpeg", "png"]:
        image = Image.open(BytesIO(file))
        return pytesseract.image_to_string(image)

    elif file_ext == "docx":
        doc = Document(BytesIO(file))
        return "\n".join([para.text for para in doc.paragraphs])

    elif file_ext == "csv":
        df = pd.read_csv(BytesIO(file))
        return df.to_string(index=False)

    elif file_ext in ["xls", "xlsx"]:
        df = pd.read_excel(BytesIO(file))
        return df.to_string(index=False)

    else:
        return "Unsupported file type."
