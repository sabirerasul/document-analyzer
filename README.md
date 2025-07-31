# AI File Analysis

This project is a web application that allows users to upload various types of files (PDF, images, documents, spreadsheets, text files), analyze their content using an AI model (Gemini), and view the results. The application handles user authentication, file storage on AWS S3, and provides download options for the analysis results in PDF and TXT formats.

## Features

*   **File Upload:** Supports drag-and-drop and file selection for various file types (PDF, JPG, PNG, DOCX, CSV, XLSX, TXT).
*   **AI-Powered Analysis:** Leverages Google Gemini to analyze file content and provide insights.
*   **Content Extraction:** Extracts text from supported file formats.
*   **AWS S3 Integration:** Stores uploaded files securely on AWS S3.
*   **User Authentication:** Secure user registration and login system using JWT and bcrypt.
*   **File History:** Users can view a history of their uploaded and analyzed files.
*   **Download Options:** Download AI analysis results as PDF or TXT files.
*   **Responsive Design:** User-friendly interface that works across different devices.

## Technologies Used

*   **Backend:**
    *   Python
    *   FastAPI (Web Framework)
    *   SQLAlchemy (ORM)
    *   uvicorn (ASGI Server)
    *   python-dotenv (Environment Variables)
    *   PyJWT (JWT Authentication)
    *   bcrypt (Password Hashing)
    *   Pydantic (Data Validation)
    *   ReportLab (PDF Generation)
    *   python-docx (DOCX Handling)
    *   Pillow (PIL) (Image Handling)
    *   pytesseract (OCR for Images)
    *   pandas (CSV/XLSX Handling)
    *   PyMuPDF (fitz) (PDF Handling)
    *   markdown (Markdown Conversion)
    *   BeautifulSoup (HTML Parsing)
    *   boto3 (AWS S3 SDK)
*   **Frontend:**
    *   HTML
    *   CSS
    *   JavaScript
    *   marked.js (Markdown Rendering)
    *   jspdf (Client-side PDF generation - *Note: Backend generates PDFs*)
    *   dompurify (HTML Sanitization)
    *   html2canvas (HTML to Canvas)
*   **Database:**
    *   PostgreSQL

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd docs-analysis
    ```

2.  **Set up a Python virtual environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows use `venv\Scripts\activate`
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
    *(Note: `requirements.txt` is not explicitly provided in the file listing, but it's a common practice. If it's missing, manual installation of the libraries mentioned above would be required.)*

4.  **Configure Environment Variables:**
    Create a `.env` file in the root directory of the project with the following variables:
    ```dotenv
    # .env
    SECRET_KEY=your_super_secret_key_here # Generate a strong, random key
    GEMINI_API_KEY=your_gemini_api_key_here
    AWS_ACCESS_KEY_ID=your_aws_access_key_id
    AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
    AWS_REGION=your_aws_region # e.g., us-east-1
    S3_BUCKET_NAME=your_s3_bucket_name
    DATABASE_URL=postgresql+psycopg2://user:password@host:port/dbname
    ```
    *Replace placeholders with your actual credentials and configuration.*

5.  **Set up PostgreSQL Database:**
    Ensure you have a PostgreSQL server running and create a database (e.g., `ai_analysis`). Update the `DATABASE_URL` in your `.env` file accordingly.

6.  **Install Tesseract OCR:**
    This project uses `pytesseract` for image analysis, which requires the Tesseract OCR engine to be installed on your system.
    *   **Ubuntu/Debian:** `sudo apt-get update && sudo apt-get install tesseract-ocr`
    *   **macOS:** `brew install tesseract`
    *   **Windows:** Download the installer from the [official Tesseract GitHub page](https://github.com/tesseract-ocr/tesseract). Make sure to add Tesseract to your system's PATH.

## Usage

1.  **Run the FastAPI backend:**
    ```bash
    uvicorn main:app --reload --host http://localhost --port 8000
    ```

2.  **Open the frontend:**
    The backend serves the frontend at `http://localhost:8000/`. Open this URL in your web browser.

3.  **Interact with the application:**
    *   **Register/Login:** Use the sidebar to create an account or log in.
    *   **Upload File:** Drag and drop a supported file onto the designated area or click to browse.
    *   **Analyze:** Once a file is uploaded, the analysis will start automatically.
    *   **View Results:** The analysis results will be displayed in the main content area.
    *   **Download:** Use the download buttons to get the analysis report in PDF or TXT format.
    *   **File History:** View your past uploads and analyses in the sidebar. You can also download original files or delete entries from here.

## File Structure

```
.
├── .env                     # Environment variables
├── auth.py                  # Authentication logic (JWT, password hashing)
├── database.py              # Database connection and session management
├── main.py                  # FastAPI application setup and API endpoints
├── models.py                # SQLAlchemy database models (User, File, AIResponse)
├── requirements.txt         # Project dependencies (assumed)
├── utils.py                 # Utility functions (S3, file extraction, etc.)
└── frontend/                # Frontend static files
    ├── index.html           # Main HTML structure
    ├── main.js              # Frontend JavaScript logic
    └── style.css            # Frontend CSS styling
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open an issue.

## License

This project is licensed under the MIT License.
