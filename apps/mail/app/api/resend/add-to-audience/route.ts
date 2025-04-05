import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server';

// We'll initialize the Resend client inside the handler to ensure
// environment variables are properly loaded

export async function POST(request: NextRequest) {
  // Initialize Resend client with environment variables
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendAudienceId = process.env.RESEND_AUDIENCE_ID;
  
  console.log('API Key available:', !!resendApiKey);
  console.log('Audience ID:', resendAudienceId);
  
  try {
    // Validate API key and audience ID
    if (!resendApiKey || !resendAudienceId) {
      console.error('Resend API key or audience ID not configured');
      return NextResponse.json(
        { success: false, error: 'Resend API key or audience ID not configured' },
        { status: 500 }
      );
    }
    
    // Get emails from request body
    const body = await request.json();
    console.log('Request body received:', body);
    
    const { emails } = body;
    
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      console.error('No emails provided in request body:', body);
      return NextResponse.json(
        { success: false, error: 'No emails provided' },
        { status: 400 }
      );
    }
    
    console.log(`Processing ${emails.length} emails for Resend audience...`);

    // Process each email one by one with careful error handling
    const results = [];
    const successfulEmails = [];
    const failedEmails = [];
    
    // Initialize a fresh Resend client for each request
    const resend = new Resend(resendApiKey);
    
    // Process each email sequentially with individual error handling
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      console.log(`[${i+1}/${emails.length}] Processing email: ${email}`);
      
      try {
        // Verify the email is valid
        if (!email || typeof email !== 'string' || !email.includes('@')) {
          console.error(`Invalid email format: ${email}`);
          failedEmails.push(email);
          results.push({ email, success: false, error: 'Invalid email format' });
          continue;
        }
        
        console.log(`Adding ${email} to Resend audience ${resendAudienceId}...`);
        
        // Make the API call with explicit error handling
        try {
          const response = await resend.contacts.create({
            email: email,
            audienceId: resendAudienceId,
            unsubscribed: false
          });
          
          // Verify the response
          if (response && response.data && response.data.id) {
            console.log(`Successfully added ${email} to audience with ID: ${response.data.id}`);
            successfulEmails.push(email);
            results.push({ email, success: true, response });
          } else {
            console.error(`Unexpected response format for ${email}:`, response);
            failedEmails.push(email);
            results.push({ email, success: false, error: 'Unexpected response format' });
          }
        } catch (apiErr) {
          console.error(`API error adding ${email} to Resend audience:`, apiErr);
          failedEmails.push(email);
          results.push({ email, success: false, error: apiErr });
        }
      } catch (err) {
        // Catch any unexpected errors
        console.error(`Unexpected error processing ${email}:`, err);
        failedEmails.push(email);
        results.push({ email, success: false, error: err });
      }
      
      // Add a small delay between requests to avoid rate limiting
      if (i < emails.length - 1) {
        console.log(`Waiting before processing next email...`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Increased delay
      }
    }
    
    console.log(`Processing complete. Success: ${successfulEmails.length}/${emails.length}, Failed: ${failedEmails.length}/${emails.length}`);
    if (failedEmails.length > 0) {
      console.log(`Failed emails: ${failedEmails.join(', ')}`);
    }
    
    // Calculate final results
    const allSuccessful = failedEmails.length === 0;
    
    // Detailed logging of results
    console.log(`Resend audience update complete.`);
    console.log(`Total emails: ${emails.length}`);
    console.log(`Successfully added: ${successfulEmails.length}`);
    console.log(`Failed to add: ${failedEmails.length}`);
    
    return NextResponse.json({ 
      success: allSuccessful,
      totalProcessed: emails.length,
      successfulCount: successfulEmails.length,
      failedCount: failedEmails.length,
      successfulEmails,
      failedEmails,
      detailedResults: results
    });
  } catch (error) {
    // Log the full error with stack trace if available
    console.error('Error adding users to Resend audience:');
    console.error(error);
    
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
    
    try {
      console.error('Stringified error:', JSON.stringify(error, null, 2));
    } catch (e) {
      console.error('Error could not be stringified:', e);
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
