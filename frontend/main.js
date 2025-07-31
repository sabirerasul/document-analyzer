// Allowed file types
const ALLOWED_FILE_TYPES = ['.pdf', '.jpg', '.jpeg', '.png', '.docx', '.csv', '.xlsx', '.xls', '.txt'];

// DOM Elements
const dragDropArea = document.getElementById('dragDropArea');
const fileInput = document.getElementById('fileInput');
const demoSection = document.getElementById('demoSection');
const downloadSection = document.getElementById('downloadSection');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const downloadTxtBtn = document.getElementById('downloadTxtBtn');
const authSection = document.getElementById('authSection');
const profileSection = document.getElementById('profileSection');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterBtn = document.getElementById('showRegister');
const showLoginBtn = document.getElementById('showLogin');
const loginUsernameInput = document.getElementById('loginUsername');
const loginPasswordInput = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const registerUsernameInput = document.getElementById('registerUsername');
const registerPasswordInput = document.getElementById('registerPassword');
const registerBtn = document.getElementById('registerBtn');
const usernameDisplay = document.getElementById('usernameDisplay');
const logoutBtn = document.getElementById('logoutBtn');
// const uploadAnalyzeBtn = document.getElementById('uploadAnalyzeBtn');
const fileHistoryList = document.getElementById('fileHistoryList');
const uploadSection = document.getElementById('uploadSection');
const notificationContainer = document.getElementById('notification-container');

// --- Notification Function ---
function showNotification(message, type = 'info', duration = 3000) {
  const notification = document.createElement('div');
  notification.classList.add('notification', type);
  notification.style.setProperty('--notification-duration', `${duration / 1000}s`);

  const icons = {
    success: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>`,
    info: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.852l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>`,
  };

  notification.innerHTML = `
    <div class="notification-icon" style="color: var(--${type}-500);">${icons[type]}</div>
    <div class="notification-content">
      <div class="notification-message">${message}</div>
    </div>
  `;

  notificationContainer.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, duration);
}

// State variables
let analysisResults = null;
let currentFileName = '';
let currentFileType = '';
let isAnalyzing = false;
let currentFileId = null; // To store the ID of the currently analyzed file for history/downloads
let currentAIResponseId = null; // To store the ID of the AI response for downloads

const API_BASE_URL = 'http://localhost:8000';

// --- API Fetch Wrapper ---
async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('accessToken');
  
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    // Token is invalid or expired
    showNotification('Session expired. Please log in again.', 'error');
    handleLogout(); // This will clear storage and update UI
    // Stop further execution by throwing an error that can be caught silently
    throw new Error('Unauthorized'); 
  }

  return response;
}


// Event Listeners
dragDropArea.addEventListener('dragenter', handleDragEnter);
dragDropArea.addEventListener('dragover', handleDragOver);
dragDropArea.addEventListener('dragleave', handleDragLeave);
dragDropArea.addEventListener('drop', handleDrop);
dragDropArea.addEventListener('click', () => {
  if (!isAnalyzing && localStorage.getItem('accessToken')) { // Only allow upload if logged in
    fileInput.click();
  } else if (!localStorage.getItem('accessToken')) {
    showNotification('Please login or register to upload and analyze files.', 'info');
  }
});

fileInput.addEventListener('change', handleFileSelect);
downloadPdfBtn.addEventListener('click', () => handleDownload('pdf'));
downloadTxtBtn.addEventListener('click', () => handleDownload('txt'));

// Auth Event Listeners
showRegisterBtn.addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.style.display = 'none';
  registerForm.style.display = 'block';
});

showLoginBtn.addEventListener('click', (e) => {
  e.preventDefault();
  registerForm.style.display = 'none';
  loginForm.style.display = 'block';
});

loginBtn.addEventListener('click', handleLogin);
registerBtn.addEventListener('click', handleRegister);
logoutBtn.addEventListener('click', handleLogout);
// uploadAnalyzeBtn.addEventListener('click', () => {
//   if (!isAnalyzing) {
//     fileInput.click();
//   }
// });


// --- Authentication Functions ---

async function handleRegister() {
  const username = registerUsernameInput.value;
  const password = registerPasswordInput.value;

  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Registration failed');
    }

    showNotification('Registration successful! Please login.', 'success');
    registerUsernameInput.value = '';
    registerPasswordInput.value = '';
    showLoginBtn.click(); // Switch to login form
  } catch (error) {
    showNotification(`Registration Error: ${error.message}`, 'error');
    console.error('Registration Error:', error);
  }
}

async function handleLogin() {
  const username = loginUsernameInput.value;
  const password = loginPasswordInput.value;

  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: username,
        password: password,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Login failed');
    }

    const data = await response.json();
    localStorage.setItem('accessToken', data.access_token);
    localStorage.setItem('username', username); // Store username
    showNotification('Login successful!', 'success');
    loginUsernameInput.value = '';
    loginPasswordInput.value = '';
    updateAuthUI();
    fetchFileHistory(); // Load history after login
  } catch (error) {
    showNotification(`Login Error: ${error.message}`, 'error');
    console.error('Login Error:', error);
  }
}

function handleLogout() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('username');
  showNotification('Logged out successfully.', 'success');
  updateAuthUI();
  fileHistoryList.innerHTML = ''; // Clear history
  hideAnalysisResults(); // Hide analysis sections
}

function updateAuthUI() {
  const accessToken = localStorage.getItem('accessToken');
  const username = localStorage.getItem('username');

  if (accessToken && username) {
    authSection.style.display = 'none';
    profileSection.style.display = 'block';
    usernameDisplay.textContent = username;
    uploadSection.style.display = 'block'; // Show upload section
  } else {
    authSection.style.display = 'block';
    profileSection.style.display = 'none';
    uploadSection.style.display = 'none'; // Hide upload section
  }
}

// --- File Handling Functions ---

function handleDragEnter(e) {
  e.preventDefault();
  if (!isAnalyzing && localStorage.getItem('accessToken')) {
    dragDropArea.classList.add('drag-over');
  }
}

function handleDragOver(e) {
  e.preventDefault();
  if (!isAnalyzing && localStorage.getItem('accessToken')) {
    dragDropArea.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  e.preventDefault();
  if (!dragDropArea.contains(e.relatedTarget) && localStorage.getItem('accessToken')) {
    dragDropArea.classList.remove('drag-over');
  }
}

function handleDrop(e) {
  e.preventDefault();
  dragDropArea.classList.remove('drag-over');
  
  if (!isAnalyzing && localStorage.getItem('accessToken')) {
    const files = e.dataTransfer.files;
    handleFiles(files);
  }
}

function handleFileSelect(e) {
  if (!isAnalyzing && localStorage.getItem('accessToken')) {
    const files = e.target.files;
    handleFiles(files);
  }
}

function validateFileType(fileName) {
  const fileExtension = '.' + fileName.split('.').pop().toLowerCase();
  return ALLOWED_FILE_TYPES.includes(fileExtension);
}

function getFileType(fileName) {
  const extension = '.' + fileName.split('.').pop().toLowerCase();
  
  if (['.jpg', '.jpeg', '.png'].includes(extension)) {
    return 'image';
  } else if (['.pdf'].includes(extension)) {
    return 'document';
  } else if (['.docx'].includes(extension)) {
    return 'document';
  } else if (['.csv', '.xlsx', '.xls'].includes(extension)) {
    return 'spreadsheet';
  } else if (['.txt'].includes(extension)) {
    return 'text';
  }
  return 'unknown';
}

function getAnalysisPrompt(fileType, fileName) {
  const basePrompt = `Analyze this ${fileType} file "${fileName}" and provide comprehensive insights including:`;
  
  switch (fileType) {
    case 'image':
      return `${basePrompt}
      - Visual content description and objects detected
      - Image quality and technical specifications
      - Potential use cases and applications
      - Color analysis and composition
      - Text extraction if any OCR content is found
      - Metadata information if available`;
      
    case 'document':
      return `${basePrompt}
      - Document structure and formatting analysis
      - Content summary and key topics
      - Sentiment analysis of the text
      - Named entity recognition (people, organizations, locations, dates)
      - Language and readability analysis
      - Document classification and purpose`;
      
    case 'spreadsheet':
      return `${basePrompt}
      - Data structure and column analysis
      - Statistical summary of numerical data
      - Data quality assessment (missing values, duplicates)
      - Pattern recognition and trends
      - Data types and format validation
      - Potential data visualization suggestions`;
      
    case 'text':
      return `${basePrompt}
      - Text content analysis and summary
      - Sentiment and tone analysis
      - Key themes and topics extraction
      - Named entity recognition
      - Language detection and complexity analysis
      - Word frequency and linguistic patterns`;
      
    default:
      return `${basePrompt}
      - File format and structure analysis
      - Content extraction and summary
      - Data patterns and insights
      - Quality assessment
      - Potential applications and use cases`;
  }
}

async function handleFiles(files) {
  if (files.length > 0) {
    const file = files[0]; // Process first file
    
    // Validate file type
    if (!validateFileType(file.name)) {
      showFileTypeError(file.name);
      return;
    }
    
    currentFileName = file.name;
    currentFileType = getFileType(file.name);
    
    console.log(`Processing ${currentFileType} file: ${file.name} (${formatFileSize(file.size)})`);
    
    // Show upload feedback
    showUploadFeedback(file.name);
    
    // Start analysis
    await analyzeFile(file);
  }
}

async function analyzeFile(file) {
  isAnalyzing = true;
  updateUIForAnalysis(true);
  hideAnalysisResults(); // Hide previous results

  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("prompt", getAnalysisPrompt(currentFileType, currentFileName));
    
    const response = await fetchWithAuth(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    analysisResults = result.ai_response;
    currentFileId = result.id;
    currentAIResponseId = result.ai_response.id;
    
    // Update content based on file type
    updateContentForFileType(currentFileType, currentFileName);
    
    // Update demo section with real results
    displayContentInDemoBox(analysisResults.response_text);
    
    // Show sections after successful analysis
    showAnalysisResults();
    
    showAnalysisComplete(currentFileName);
    fetchFileHistory(); // Refresh history after new upload
    
  } catch (error) {
    console.error('Analysis failed:', error);
    showAnalysisError(error.message);
  } finally {
    isAnalyzing = false;
    updateUIForAnalysis(false);
  }
}

function updateContentForFileType(fileType, fileName) {
  const demoTitle = document.getElementById('demoTitle');
  const downloadDescription = document.getElementById('downloadDescription');
  
  demoTitle.textContent = 'Analysis Results';
  downloadDescription.textContent = 'Download the complete analysis with comprehensive insights and recommendations.';
}

function showAnalysisResults() {
  // Show demo and download sections with animation
  demoSection.style.display = 'block';
  downloadSection.style.display = 'block';
  
  setTimeout(() => {
    demoSection.classList.add('fade-in');
    downloadSection.classList.add('fade-in');
  }, 100);
  
  // Enable download buttons
  downloadPdfBtn.disabled = false;
  downloadTxtBtn.disabled = false;

  // Add event listeners now that the elements are visible
  const copyBtn = document.querySelector('.code-action');
  copyBtn.addEventListener('click', async () => {
    const codeContent = document.querySelector('.demo-text').textContent;
    try {
      await navigator.clipboard.writeText(codeContent);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  });
}

function hideAnalysisResults() {
  demoSection.style.display = 'none';
  downloadSection.style.display = 'none';
  demoSection.classList.remove('fade-in');
  downloadSection.classList.remove('fade-in');
}

function updateUIForAnalysis(analyzing) {
  const uploadTitle = document.querySelector('.upload-title');
  const uploadDescription = document.querySelector('.upload-description');
  const uploadIcon = document.querySelector('.upload-icon svg');
  
  if (analyzing) {
    uploadTitle.textContent = `Analyzing ${currentFileType} file...`;
    uploadTitle.style.color = 'var(--primary-600)';
    uploadDescription.textContent = 'Please wait while we process your file with AI';
    dragDropArea.style.pointerEvents = 'none';
    dragDropArea.style.opacity = '0.7';
    
    // Add spinning animation to icon
    uploadIcon.style.animation = 'spin 2s linear infinite';
  } else {
    uploadTitle.textContent = 'Drop your files here';
    uploadTitle.style.color = '';
    uploadDescription.textContent = 'or click to browse files';
    dragDropArea.style.pointerEvents = '';
    dragDropArea.style.opacity = '';
    uploadIcon.style.animation = '';
  }
}

function displayContentInDemoBox(content) {
  const demoContent = document.getElementById('demoContent');
  demoContent.innerHTML = marked.parse(content);
}

function showFileTypeError(fileName) {
  const uploadTitle = document.querySelector('.upload-title');
  const uploadDescription = document.querySelector('.upload-description');
  
  uploadTitle.textContent = 'Invalid file type';
  uploadTitle.style.color = 'var(--error-500)';
  uploadDescription.textContent = `"${fileName}" is not supported. Please use: ${ALLOWED_FILE_TYPES.join(', ')}`;
  
  // Reset after 5 seconds
  setTimeout(() => {
    uploadTitle.textContent = 'Drop your files here';
    uploadTitle.style.color = '';
    uploadDescription.textContent = 'or click to browse files';
  }, 5000);
}

function showUploadFeedback(fileName) {
  const uploadTitle = document.querySelector('.upload-title');
  const uploadDescription = document.querySelector('.upload-description');
  
  uploadTitle.textContent = `File "${fileName}" uploaded successfully!`;
  uploadTitle.style.color = 'var(--success-500)';
  uploadDescription.textContent = 'Starting AI analysis...';
}

function showAnalysisComplete(fileName) {
  const uploadTitle = document.querySelector('.upload-title');
  const uploadDescription = document.querySelector('.upload-description');
  
  uploadTitle.textContent = `Analysis complete for "${fileName}"`;
  uploadTitle.style.color = 'var(--success-500)';
  uploadDescription.textContent = 'Results are ready for download';
}

function showAnalysisError(errorMessage) {
  const uploadTitle = document.querySelector('.upload-title');
  const uploadDescription = document.querySelector('.upload-description');
  
  uploadTitle.textContent = 'Analysis failed';
  uploadTitle.style.color = 'var(--error-500)';
  uploadDescription.textContent = `Error: ${errorMessage}`;
  
  // Reset after 5 seconds
  setTimeout(() => {
    uploadTitle.textContent = 'Drop your files here';
    uploadTitle.style.color = '';
    uploadDescription.textContent = 'or click to browse files';
  }, 5000);
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// This function is no longer needed as backend handles PDF/TXT generation
// function generateTextReport(results) {
//   let report = '';
//   if (results && results.summary) {
//     const rawHtml = marked.parse(results.summary);
//     const tempDiv = document.createElement('div');
//     tempDiv.innerHTML = rawHtml;
//     report = tempDiv.textContent || tempDiv.innerText || '';
//   } else if (typeof results === 'string') {
//     report = results;
//   } else {
//     report = JSON.stringify(results, null, 2);
//   }
//   return report;
// }

// This function is no longer needed as backend handles PDF/TXT generation
// function generatePDFContent(results) {
//   const timestamp = new Date().toLocaleString();
//   const fileTypeTitle = currentFileType.charAt(0).toUpperCase() + currentFileType.slice(1);
  
//   let htmlContent = `
//     <!DOCTYPE html>
//     <html>
//     <head>
//       <meta charset="UTF-8">
//       <title>AI Analysis Report - ${currentFileName}</title>
//       <style>
//         body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; font-size: 12px; }
//         .info-section { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
//         .info-title { font-weight: bold; color: #333; margin-bottom: 10px; }
//         .results-section { margin: 30px 0; }
//         .json-content { white-space: pre-wrap; }
//       </style>
//     </head>
//     <body>
//       <div class="info-section">
//         <div class="info-title">File Information</div>
//         <p><strong>File Name:</strong> ${currentFileName}</p>
//         <p><strong>File Type:</strong> ${fileTypeTitle}</p>
//         <p><strong>Analysis Date:</strong> ${timestamp}</p>
//       </div>
      
//       <div class="results-section">
//         <div class="info-title">Analysis Results</div>
//         <div class="json-content">${marked.parse(results.summary)}</div>
//       </div>
//     </body>
//     </html>
//   `;
  
//   return htmlContent;
// }

async function handleDownload(format) {
  if (!currentAIResponseId) {
    showNotification('No analysis results available for download.', 'info');
    return;
  }

  const button = format === 'pdf' ? downloadPdfBtn : downloadTxtBtn;
  const originalBtnHTML = button.innerHTML;
  toggleButtonLoading(button, true);
  
  const accessToken = localStorage.getItem('accessToken');
  let url = '';
  let mediaType = '';
  let filename = '';

  if (format === 'pdf') {
    url = `${API_BASE_URL}/download/${currentAIResponseId}/pdf`;
    mediaType = 'application/pdf';
    filename = `ai_analysis_${currentFileName.split('.')[0]}.pdf`;
  } else if (format === 'txt') {
    url = `${API_BASE_URL}/download/${currentAIResponseId}/txt`;
    mediaType = 'text/plain';
    filename = `ai_analysis_${currentFileName.split('.')[0]}.txt`;
  } else if (format === 'original') {
    if (!currentFileId) {
      showNotification('Original file not available for download.', 'info');
      return;
    }
    url = `${API_BASE_URL}/download/${currentFileId}/original`;
    mediaType = 'application/octet-stream';
    filename = currentFileName;
  } else {
    return;
  }

  try {
    const response = await fetchWithAuth(url);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);

    showDownloadFeedback(format === 'pdf' ? downloadPdfBtn : downloadTxtBtn, `${format.toUpperCase()} Downloaded!`);

  } catch (error) {
    showNotification(`Download failed: ${error.message}`, 'error');
    console.error('Download Error:', error);
  } finally {
    toggleButtonLoading(button, false, originalBtnHTML);
  }
}

function toggleButtonLoading(button, isLoading, originalHTML = null) {
    if (isLoading) {
        button.disabled = true;
        // Store the original content only if it hasn't been stored yet
        if (!button.dataset.originalHtml) {
            button.dataset.originalHtml = button.innerHTML;
        }
        button.innerHTML = `<svg class="spinner" viewBox="0 0 50 50"><circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle></svg>`;
    } else {
        button.disabled = false;
        // Restore the original content
        button.innerHTML = originalHTML || button.dataset.originalHtml;
        // Clean up the stored attribute
        delete button.dataset.originalHtml;
    }
}

function showDownloadFeedback(button, message) {
  const originalHTML = button.innerHTML;
  const originalBg = button.style.background;
  
  button.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    ${message}
  `;
  button.style.background = 'var(--success-500)';
  
  setTimeout(() => {
    button.innerHTML = originalHTML;
    button.style.background = originalBg;
  }, 2000);
}

// --- File History Functions ---

async function fetchFileHistory() {
  const accessToken = localStorage.getItem('accessToken');
  const historyLoader = document.getElementById('historyLoader');

  if (!accessToken) {
    fileHistoryList.innerHTML = '<li class="no-history">Please log in to view file history.</li>';
    return;
  }

  historyLoader.style.display = 'flex'; // Changed to flex for better centering
  fileHistoryList.style.display = 'none'; // Hide the list while loading
  fileHistoryList.innerHTML = ''; // Clear previous history

  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/history`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch file history');
    }

    const history = await response.json();
    displayFileHistory(history);
  } catch (error) {
    console.error('Error fetching file history:', error);
    fileHistoryList.innerHTML = `<li class="no-history">Error loading history: ${error.message}</li>`;
  } finally {
    historyLoader.style.display = 'none';
    fileHistoryList.style.display = 'block'; // Show the list after loading
  }
}

function displayFileHistory(history) {
  fileHistoryList.innerHTML = ''; // Clear current list
  if (history.length === 0) {
    fileHistoryList.innerHTML = '<li class="no-history">No files uploaded yet.</li>';
    return;
  }

  history.forEach(file => {
    const listItem = document.createElement('li');
    listItem.classList.add('file-history-item');
    
    const uploadDate = new Date(file.upload_timestamp).toLocaleString();
    
    let aiResponseContent = '<p>No AI analysis available.</p>';
    let downloadButtons = '';

    if (file.ai_response) {
      aiResponseContent = `<div class="ai-response-preview">${marked.parse(file.ai_response.response_text.substring(0, 150) + '...')}</div>`; // Show preview
      downloadButtons = `
        <div class="history-download-options">
          <button class="btn small download-original-btn" data-file-id="${file.id}" data-filename="${file.filename}">Original</button>
          <button class="btn small download-pdf-btn" data-ai-response-id="${file.ai_response.id}" data-filename="${file.filename}">PDF</button>
          <button class="btn small download-txt-btn" data-ai-response-id="${file.ai_response.id}" data-filename="${file.filename}">TXT</button>
          <button class="btn small delete-btn" data-file-id="${file.id}">Delete</button>
        </div>
      `;
    }

    listItem.innerHTML = `
      <div class="file-info">
        <span class="file-name">${file.filename}</span>
        <span class="file-date">${uploadDate}</span>
      </div>
      <div class="file-details">
        ${aiResponseContent}
        ${downloadButtons}
      </div>
    `;
    fileHistoryList.appendChild(listItem);
  });

  // Add event listeners for history download buttons
  fileHistoryList.querySelectorAll('.download-original-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const fileId = e.target.dataset.fileId;
      const filename = e.target.dataset.filename;
      handleHistoryDownload(fileId, filename, 'original', e.target);
    });
  });
  fileHistoryList.querySelectorAll('.download-pdf-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const aiResponseId = e.target.dataset.aiResponseId;
      const filename = e.target.dataset.filename;
      handleHistoryDownload(aiResponseId, filename, 'pdf', e.target);
    });
  });
  fileHistoryList.querySelectorAll('.download-txt-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const aiResponseId = e.target.dataset.aiResponseId;
      const filename = e.target.dataset.filename;
      handleHistoryDownload(aiResponseId, filename, 'txt', e.target);
    });
  });

  fileHistoryList.querySelectorAll('.delete-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const fileId = e.target.dataset.fileId;
      handleDeleteFile(fileId, e.target.closest('.file-history-item'));
    });
  });
}

async function handleDeleteFile(fileId, listItemElement) {
  const deleteButton = listItemElement.querySelector('.delete-btn');
  if (!confirm('Are you sure you want to delete this file and its analysis? This action cannot be undone.')) {
    return;
  }
  const originalBtnHTML = deleteButton.innerHTML;
  toggleButtonLoading(deleteButton, true);

  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/files/${fileId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to delete file');
    }

    showNotification('File deleted successfully!', 'success');
    listItemElement.remove(); // Remove the item from the UI
    // Optional: check if history is now empty and show message
    if (fileHistoryList.children.length === 0) {
        displayFileHistory([]);
    }

  } catch (error) {
    if (error.message !== 'Unauthorized') { // Don't show notification for auth errors as it's handled
        showNotification(`Error deleting file: ${error.message}`, 'error');
        console.error('Error deleting file:', error);
    }
  } finally {
    toggleButtonLoading(deleteButton, false, originalBtnHTML);
  }
}

async function handleHistoryDownload(id, filename, format, button) {
  const originalBtnHTML = button.innerHTML;
  toggleButtonLoading(button, true);
  const accessToken = localStorage.getItem('accessToken');
  let url = '';
  let mediaType = '';
  let downloadFilename = '';

  if (format === 'original') {
    url = `${API_BASE_URL}/download/${id}/original`;
    mediaType = 'application/octet-stream';
    downloadFilename = filename;
  } else if (format === 'pdf') {
    url = `${API_BASE_URL}/download/${id}/pdf`;
    mediaType = 'application/pdf';
    downloadFilename = `ai_analysis_${filename.split('.')[0]}.pdf`;
  } else if (format === 'txt') {
    url = `${API_BASE_URL}/download/${id}/txt`;
    mediaType = 'text/plain';
    downloadFilename = `ai_analysis_${filename.split('.')[0]}.txt`;
  } else {
    return;
  }

  try {
    const response = await fetchWithAuth(url);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = downloadFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);

    showNotification(`${format.toUpperCase()} downloaded successfully!`, 'success');

  } catch (error) {
    showNotification(`Download failed: ${error.message}`, 'error');
    console.error('History Download Error:', error);
  } finally {
    toggleButtonLoading(button, false, originalBtnHTML);
  }
}


// Initialize the app
window.addEventListener('load', () => {
  document.body.classList.add('fade-in');
  
  // Initially disable download buttons and hide sections
  downloadPdfBtn.disabled = true;
  downloadTxtBtn.disabled = true;
  hideAnalysisResults(); // Use the new function to hide
  
  updateAuthUI(); // Check login status on load
  fetchFileHistory(); // Fetch history on load
});
