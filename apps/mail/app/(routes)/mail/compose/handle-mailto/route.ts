import { NextRequest, NextResponse } from 'next/server';
import { createDraft } from '@/actions/drafts';
import { auth } from '@/lib/auth';

// Function to validate an email address
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Function to validate and parse a mailto URL
async function parseMailtoUrl(mailtoUrl: string) {
  try {
    let toEmail = '';
    let subject = '';
    let body = '';
    let cc = '';
    let bcc = '';
    
    // Extract the email address from the mailto URL
    const emailMatch = mailtoUrl.match(/^mailto:([^?]+)/);
    if (emailMatch && emailMatch[1]) {
      toEmail = decodeURIComponent(emailMatch[1]);
    }
    
    // Extract query parameters
    const queryParamsMatch = mailtoUrl.match(/\?(.+)$/);
    if (queryParamsMatch && queryParamsMatch[1]) {
      try {
        const queryString = queryParamsMatch[1];
        const queryParams = new URLSearchParams(queryString);
        
        const rawSubject = queryParams.get('subject') || '';
        const rawBody = queryParams.get('body') || '';
        const rawCC = queryParams.get('cc') || '';
        const rawBCC = queryParams.get('bcc') || '';
        
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
        
        try {
          cc = decodeURIComponent(rawCC);
        } catch (e) {
          cc = rawCC;
        }
        
        try {
          bcc = decodeURIComponent(rawBCC);
        } catch (e) {
          bcc = rawBCC;
        }
      } catch (e) {
        console.error('Error parsing query parameters:', e);
      }
    }
    
    // Return the parsed data if email is valid
    if (toEmail && isValidEmail(toEmail)) {
      console.log('Parsed mailto data:', { to: toEmail, subject, body, cc, bcc });
      return { to: toEmail, subject, body, cc, bcc };
    }
  } catch (error) {
    console.error('Failed to parse mailto URL:', error);
  }
  
  return null;
}

// Function to create a draft and get its ID
async function createDraftFromMailto(mailtoData: { to: string; subject: string; body: string; cc: string; bcc: string }) {
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
      attachments: [],
      cc: mailtoData.cc,
      bcc: mailtoData.bcc
    };
    
  
    const result = await createDraft(draftData);
    
    console.log('Draft creation result:', result);
    
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