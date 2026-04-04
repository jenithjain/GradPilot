import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getReasoningModel } from '@/lib/gemini';
import path from 'path';

// Force Node.js runtime for file processing libraries
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) console.log('=== OCR API Route Hit ===');
  
  try {
    // Dynamic imports to avoid module resolution issues
    const { createWorker } = await import('tesseract.js');
    const pdfParse = (await import('pdf-parse')).default;
    
    if (isDev) console.log('Modules loaded successfully');
    
    const session = await getServerSession(authOptions);
    
    if (!session) {
      if (isDev) console.log('No session found');
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to continue.' },
        { status: 401 }
      );
    }

    if (isDev) console.log('Session valid for user:', session.user?.email);

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      if (isDev) console.log('No file in formData');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (isDev) console.log('File received:', file.name, 'Type:', file.type, 'Size:', file.size);

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Get file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let extractedText = '';

    // Handle PDF files
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      try {
        if (isDev) console.log('Processing PDF file:', file.name, 'size:', buffer.length);
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text;
        if (isDev) console.log('PDF extracted text length:', extractedText.length);
      } catch (error) {
        console.error('PDF parsing error:', error.message);
        return NextResponse.json(
          { error: `PDF parsing failed: ${error.message}. Please ensure the PDF is not password-protected or corrupted.` },
          { status: 400 }
        );
      }
    }
    // Handle image files (JPG, PNG, etc.)
    else if (file.type.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(file.name)) {
      try {
        if (isDev) console.log('Processing image file:', file.name, 'type:', file.type);
        const worker = await createWorker('eng', 1, {
          workerBlobURL: false,
          workerPath: path.join(process.cwd(), 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js'),
          logger: isDev ? m => console.log('Tesseract:', m) : undefined
        });
        
        await worker.setParameters({
          tessedit_pageseg_mode: '1', // Automatic page segmentation
        });
        
        const { data: { text, confidence } } = await worker.recognize(buffer);
        await worker.terminate();
        
        extractedText = text;
        if (isDev) console.log('OCR extracted text length:', extractedText.length, 'confidence:', confidence);
      } catch (error) {
        console.error('OCR error:', error.message);
        return NextResponse.json(
          { error: `Image OCR failed: ${error.message}. Please ensure the image is clear and contains readable text.` },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Please upload a PDF or image file (JPG, PNG).` },
        { status: 400 }
      );
    }

    // More lenient text length check
    if (!extractedText || extractedText.trim().length < 20) {
      console.warn('Insufficient text extracted. Length:', extractedText?.trim().length || 0);
      return NextResponse.json(
        { error: `Could not extract sufficient text (only ${extractedText?.trim().length || 0} characters found). Please try a clearer document or manual entry.` },
        { status: 400 }
      );
    }

    // Use Gemini LLM to extract structured KYC fields from the text
    const model = getReasoningModel();
    
    const prompt = `You are a student data extraction assistant. Extract student academic and personal information from the following document text (student ID card, marksheet, transcript, or degree certificate) and return it in JSON format.

Document Text:
${extractedText}

Extract and return ONLY a valid JSON object with these fields (use null for fields not found):
{
  "educationLevel": "one of: 10th/SSC, 12th/HSC, Diploma, Bachelors, Masters, PhD, Other",
  "fieldOfStudy": "one of: Engineering, Business/MBA, Medicine, Arts & Humanities, Science, Law, IT/Computer Science, Other",
  "institution": "string - name of school/college/university or null",
  "gpaPercentage": "one of: Below 50%, 50-60%, 60-70%, 70-80%, 80-90%, 90%+",
  "testStatus": "one of: Not Started, Preparing, Booked Exam, Score Available, Not Required",
  "testScore": "one of: Below 5.5, 5.5-6.0, 6.0-6.5, 6.5-7.0, 7.0-7.5, 7.5+, N/A",
  "targetCountries": ["array of: UK, Ireland, USA, Canada, Australia, Germany, Other"],
  "courseInterest": "one of: Undergraduate, Postgraduate/Masters, PhD/Research, Foundation Year, English Language Course, Other",
  "intakeTiming": "one of: January 2026, May 2026, September 2026, January 2027, Not Sure",
  "applicationTimeline": "one of: Immediately, Within 1 Month, 1-3 Months, 3-6 Months, 6+ Months",
  "budgetRange": "one of: Below ₹10 Lakhs, ₹10-20 Lakhs, ₹20-30 Lakhs, ₹30-50 Lakhs, ₹50 Lakhs+",
  "scholarshipInterest": "one of: Yes, definitely need scholarship, Interested but not essential, No, self-funded, Education loan planned",
  "primaryObjective": "one of: Career Advancement, Better Job Opportunities, Research & Academia, Immigration/PR, Personal Growth, Other",
  "painPoints": ["array of: University Selection, Visa Process, Financial Planning, Test Preparation, Application Deadlines, Accommodation"],
  "studentName": "string or null",
  "rollNumber": "string or null",
  "universityRegNumber": "string or null",
  "dateOfBirth": "string or null"
}

Return ONLY the JSON object, no explanations or additional text.`;

    if (isDev) console.log('Sending to Gemini, text length:', extractedText.length);
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    if (isDev) console.log('Gemini response received');
    
    // Extract JSON from response
    let extractedData;
    try {
      // Try to find JSON in the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
        if (isDev) console.log('Extracted fields:', Object.keys(extractedData).length);
      } else {
        console.error('No JSON found in Gemini response');
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse LLM response:', parseError.message);
      return NextResponse.json(
        { error: 'AI extraction failed. Please try manual entry or a different document.' },
        { status: 500 }
      );
    }

    // Clean up the extracted data - remove null values
    const cleanedData = {};
    for (const [key, value] of Object.entries(extractedData)) {
      if (value !== null && value !== undefined && value !== '' && 
          !(Array.isArray(value) && value.length === 0)) {
        cleanedData[key] = value;
      }
    }

    return NextResponse.json({
      success: true,
      extractedText: extractedText.substring(0, 500) + '...', // First 500 chars for reference
      extractedData: cleanedData,
      fieldsFound: Object.keys(cleanedData).length,
      message: `Successfully extracted ${Object.keys(cleanedData).length} fields from your document.`
    });

  } catch (error) {
    console.error('Document extraction error:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error('Error stack:', error.stack);
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to process document. Please try again or use manual entry.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
