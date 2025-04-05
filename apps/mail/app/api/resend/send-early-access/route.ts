import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const resendApiKey = process.env.RESEND_API_KEY;
  
  try {
    // Validate API key
    if (!resendApiKey) {
      console.error('Resend API key not configured');
      return NextResponse.json(
        { success: false, error: 'Resend API key not configured' },
        { status: 500 }
      );
    }
    
    // Get emails from request body
    const body = await request.json();
    const { emails, subject, content } = body;
    
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No emails provided' },
        { status: 400 }
      );
    }

    if (!subject || !content) {
      return NextResponse.json(
        { success: false, error: 'Subject and content are required' },
        { status: 400 }
      );
    }

    // Initialize Resend client
    const resend = new Resend(resendApiKey);
    
    // Process each email with individual error handling
    const results = [];
    const successfulEmails = [];
    const failedEmails = [];
    
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      
      try {
        // Verify the email is valid
        if (!email || typeof email !== 'string' || !email.includes('@')) {
          console.error(`Invalid email format: ${email}`);
          failedEmails.push(email);
          results.push({ email, success: false, error: 'Invalid email format' });
          continue;
        }
        
        // Send the email
        const response = await resend.emails.send({
          from: '0.email <onboarding@0.email>',
          to: email,
          subject: subject,
          html: content,
        });
        
        if (response && response.data && response.data.id) {
          console.log(`Successfully sent email to ${email}`);
          successfulEmails.push(email);
          results.push({ email, success: true, response });
        } else {
          console.error(`Unexpected response format for ${email}:`, response);
          failedEmails.push(email);
          results.push({ email, success: false, error: 'Unexpected response format' });
        }
      } catch (err) {
        console.error(`Error sending email to ${email}:`, err);
        failedEmails.push(email);
        results.push({ email, success: false, error: err });
      }
      
      // Add a small delay between requests to avoid rate limiting
      if (i < emails.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return NextResponse.json({
      success: failedEmails.length === 0,
      totalProcessed: emails.length,
      successfulCount: successfulEmails.length,
      failedCount: failedEmails.length,
      successfulEmails,
      failedEmails,
      detailedResults: results
    });
  } catch (error) {
    console.error('Error sending mass emails:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 