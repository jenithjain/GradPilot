import { NextResponse } from 'next/server';
import Papa from 'papaparse';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.csv')) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Please upload a CSV file.' },
        { status: 400 }
      );
    }

    // Read file content
    const text = await file.text();

    // Parse CSV
    const parseResult = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
    });

    if (parseResult.errors.length > 0) {
      console.error('CSV parsing errors:', parseResult.errors);
      return NextResponse.json(
        {
          success: false,
          error: 'CSV parsing failed',
          details: parseResult.errors.slice(0, 5),
        },
        { status: 400 }
      );
    }

    const rows = parseResult.data as any[];
    const emailList: Array<{ email: string; name?: string }> = [];
    const errors: string[] = [];

    // Extract emails from rows
    rows.forEach((row, index) => {
      // Look for email field (case-insensitive)
      const email = row.email || row.e_mail || row['email address'] || row.mail;
      
      if (!email) {
        errors.push(`Row ${index + 2}: No email field found`);
        return;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push(`Row ${index + 2}: Invalid email format - ${email}`);
        return;
      }

      // Extract name if available
      const name = row.name || row.full_name || row.fullname || row['first name'] || '';

      emailList.push({
        email: email.trim(),
        name: name ? name.trim() : undefined,
      });
    });

    if (emailList.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid emails found in CSV',
          details: errors.slice(0, 10),
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      emailList,
      stats: {
        total: rows.length,
        valid: emailList.length,
        invalid: errors.length,
      },
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });

  } catch (error) {
    console.error('Error parsing CSV:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse CSV',
      },
      { status: 500 }
    );
  }
}
