# KYC OCR Feature Documentation

## Overview
The KYC onboarding process now supports automatic document extraction using OCR (Optical Character Recognition) and AI-powered field mapping. Users can upload business documents to auto-fill their KYC information.

## Features

### 1. Document Upload (Step 0)
- **Supported Formats**: PDF, JPG, PNG
- **Max File Size**: 10MB
- **Optional**: Users can skip and enter information manually

### 2. OCR Processing
- **PDF Files**: Text extraction using `pdf-parse`
- **Images**: OCR using `tesseract.js` (English language)
- **Minimum Text**: Requires at least 50 characters extracted

### 3. AI Field Extraction
- **LLM**: Google Gemini 2.5 Pro
- **Smart Mapping**: Automatically maps extracted text to KYC fields
- **Supported Fields**:
  - Business Type, Industry, Employee Count
  - Revenue Tier, Business Model, Average Order Value
  - Audience Demographics, Purchase Frequency
  - Acquisition Channels, Active Platforms
  - SKU Count, Peak Seasonality
  - Primary Objective, Pain Points
  - Company Name, Registration Number, Tax ID, Address

### 4. User Experience
- **Auto-Fill**: Extracted data automatically populates form fields
- **Review & Edit**: Users can review and modify all extracted information
- **Manual Completion**: Users fill remaining fields that couldn't be extracted
- **Progress Saved**: All data can be saved for later completion

## API Endpoint

### POST `/api/kyc/extract-document`
Extracts business information from uploaded documents.

**Request**: 
- `multipart/form-data` with `file` field

**Response**:
```json
{
  "success": true,
  "extractedText": "First 500 chars of extracted text...",
  "extractedData": {
    "businessType": "LLC",
    "industry": "SaaS",
    "companyName": "Example Corp",
    ...
  },
  "fieldsFound": 12,
  "message": "Successfully extracted 12 fields from your document."
}
```

**Error Handling**:
- Unsupported file types
- File size exceeds limit
- Insufficient text extracted
- OCR/PDF parsing failures
- LLM extraction errors

## Technical Implementation

### Dependencies
```json
{
  "tesseract.js": "^5.1.1",  // OCR for images
  "pdf-parse": "^1.1.1"       // PDF text extraction
}
```

### File Structure
```
app/
  api/
    kyc/
      extract-document/
        route.js          # OCR & extraction endpoint
      route.js            # Main KYC CRUD operations
  onboarding/
    page.js               # KYC form with document upload
```

### Processing Flow
1. **File Upload**: User uploads PDF or image
2. **Text Extraction**: 
   - PDF → `pdf-parse` 
   - Image → `tesseract.js` OCR
3. **AI Processing**: Gemini LLM extracts structured fields
4. **Data Merge**: Extracted data merged with form state
5. **User Review**: User reviews and completes remaining fields
6. **Submission**: Complete KYC data saved to MongoDB

## Security Considerations
- Authentication required (NextAuth session)
- File type validation (whitelist)
- File size limits (10MB)
- No permanent storage of uploaded files
- Server-side text extraction only

## Usage Example

```javascript
// Frontend - Upload document
const formData = new FormData();
formData.append('file', file);

const response = await fetch('/api/kyc/extract-document', {
  method: 'POST',
  body: formData
});

const data = await response.json();
// data.extractedData contains parsed KYC fields
```

## Limitations
- OCR accuracy depends on document quality
- Best results with clear, high-resolution documents
- Currently supports English language only
- Some fields may require manual completion
- Complex document layouts may reduce accuracy

## Future Enhancements
- Multi-language OCR support
- Document type auto-detection
- Confidence scores for extracted fields
- Document storage for compliance
- Support for more document types
