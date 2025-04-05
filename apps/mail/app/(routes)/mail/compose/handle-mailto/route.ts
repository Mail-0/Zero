import { NextRequest, NextResponse } from 'next/server';
import { createDraft } from '@/actions/drafts';
import { auth } from '@/lib/auth';

// Function to parse mailto URLs
async function parseMailtoUrl(mailtoUrl: string) {
  if (!mailtoUrl.startsWith('mailto:')) {
    return null;
  }
  
  try {
    // Remove mailto: prefix to get the raw email and query part
    const mailtoContent = mailtoUrl.substring(7); // "mailto:".length === 7
    
    // Split at the first ? to separate email from query params
    const [emailPart, queryPart] = mailtoContent.split('?', 2);
    
    // Decode the email address - might be double-encoded
    const toEmail = decodeURIComponent(emailPart || '');
    
    // Default values
    let subject = '';
    let body = '';
    
    // Parse query parameters if they exist
    if (queryPart) {
      try {
        // Try to decode the query part - it might be double-encoded 
        // (once by the browser and once by our encodeURIComponent)
        let decodedQueryPart = queryPart;
        
        // Try decoding up to twice to handle double-encoding
        try {
          decodedQueryPart = decodeURIComponent(decodedQueryPart);
          // Try one more time in case of double encoding
          try {
            decodedQueryPart = decodeURIComponent(decodedQueryPart);
          } catch (e) {
            // If second decoding fails, use the result of the first decoding
          }
        } catch (e) {
          // If first decoding fails, try parsing directly
          decodedQueryPart = queryPart;
        }
        
        const queryParams = new URLSearchParams(decodedQueryPart);
        
        // Get and decode parameters 
        const rawSubject = queryParams.get('subject') || '';
        const rawBody = queryParams.get('body') || '';
        
        // Try to decode them in case they're still encoded
        try {
          subject = decodeURIComponent(rawSubject);
        } catch (e) {
          subject = rawSubject;
        }
        
        try {
          body = decodeURIComponent(rawBody);
        } catch (e) {
          body = rawBody;
        }
      } catch (e) {
        console.error('Error parsing query parameters:', e);
      }
    }
    
    // Return the parsed data if email is valid
    if (toEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      console.log('Parsed mailto data:', { to: toEmail, subject, body });
      return { to: toEmail, subject, body };
    }
  } catch (error) {
    console.error('Failed to parse mailto URL:', error);
  }
  
  return null;
}

// Function to create a draft and get its ID
async function createDraftFromMailto(mailtoData: { to: string; subject: string; body: string }) {
  try {
    // The driver's parseDraft function looks for text/plain MIME type
    // We need to ensure line breaks are preserved in the plain text
    // The Gmail editor will handle displaying these line breaks correctly
    
    // Ensure any non-standard line breaks are normalized to \n
    const normalizedBody = mailtoData.body
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    
    // Create proper HTML-encoded content by wrapping all paragraphs in <p> tags
    // This is the format that will work best with the editor
    const htmlContent = `<!DOCTYPE html><html><body>
      ${normalizedBody.split(/\n\s*\n/).map(paragraph => {
        return `<p>${paragraph.replace(/\n/g, '<br />').replace(/\s{2,}/g, match => '&nbsp;'.repeat(match.length))}</p>`;
      }).join('\n')}
    </body></html>`;
    
    const draftData = {
      to: mailtoData.to,
      subject: mailtoData.subject,
      message: htmlContent,
      attachments: []
    };
    
    console.log('Creating draft with body sample:', {
      to: draftData.to,
      subject: draftData.subject,
      messageSample: htmlContent.substring(0, 100) + (htmlContent.length > 100 ? '...' : '')
    });
    
    const result = await createDraft(draftData);
    
    if (result?.success && result.id) {
      console.log('Draft created successfully with ID:', result.id);
      return result.id;
    } else {
      console.error('Draft creation failed:', result?.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error creating draft from mailto:', error);
  }
  
  return null;
}

export async function GET(request: NextRequest) {
  // Check authentication first
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Get the mailto parameter from the URL
  const searchParams = request.nextUrl.searchParams;
  const mailto = searchParams.get('mailto');
  
  if (!mailto) {
    return NextResponse.redirect(new URL('/mail/compose', request.url));
  }
  
  // Parse the mailto URL
  const mailtoData = await parseMailtoUrl(mailto);
  
  // If parsing failed, redirect to empty compose
  if (!mailtoData) {
    return NextResponse.redirect(new URL('/mail/compose', request.url));
  }
  
  // Create a draft from the mailto data
  const draftId = await createDraftFromMailto(mailtoData);
  
  // If draft creation failed, redirect to empty compose
  if (!draftId) {
    return NextResponse.redirect(new URL('/mail/compose', request.url));
  }
  
  // Redirect to compose with the draft ID
  return NextResponse.redirect(new URL(`/mail/compose?draftId=${draftId}`, request.url));
} 