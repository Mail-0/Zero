'use server'

import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

function convertToGmailSearch(query: string): string {
  const lowerQuery = query.toLowerCase();
  let searchTerms = query;
  const currentYear = new Date().getFullYear();

  // Handle starred emails
  if (lowerQuery.includes('star') || lowerQuery.includes('starred')) {
    return 'is:starred';
  }

  // Handle MM/DD/YY format
  const shortDateRegex = /(\d{2})\/(\d{2})\/(\d{2})/g;
  const shortDates = Array.from(lowerQuery.matchAll(shortDateRegex));
  if (shortDates.length > 0) {
    // Convert MM/DD/YY to YYYY/MM/DD format
    const formattedDates = shortDates
      .map(match => match[0])
      .map(d => {
        const parts = d.split('/');
        if (parts.length === 3) {
          const [month, day, year] = parts;
          const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`; // Assume 20xx for years < 50
          return `${fullYear}/${month}/${day}`;
        }
        return d; // Return original if split fails
      });
    
    if (formattedDates.length > 0) {
      const dateQuery = lowerQuery.includes('before') ? `before:${formattedDates[0]}` :
                       lowerQuery.includes('after') ? `after:${formattedDates[0]}` :
                       formattedDates.length === 2 ? `after:${formattedDates[0]} before:${formattedDates[1]}` :
                       `after:${formattedDates[0]} before:${formattedDates[0]}`;
      
      // Remove the date from the search terms and sort by newest first
      searchTerms = searchTerms.replace(shortDateRegex, '').trim();
      return searchTerms ? `${searchTerms} ${dateQuery} newer_than:1y` : `${dateQuery} newer_than:1y`;
    }
  }

  // Handle year-only searches
  const yearOnlyRegex = /(?:from |in |during )?(\d{4})$/i;
  const yearMatch = lowerQuery.match(yearOnlyRegex);
  if (yearMatch !== null && yearMatch.length >= 2) {
    const yearStr = yearMatch[1];
    if (yearStr) {
      const year = parseInt(yearStr);
      if (!isNaN(year)) {
        const startStr = `${year}/01/01`;
        const endStr = `${year + 1}/01/01`;
        const matchedText = yearMatch[0];
        if (matchedText) {
          searchTerms = searchTerms.replace(matchedText, '').trim();
          // Sort by newest first within the year range
          const dateQuery = `after:${startStr} before:${endStr}`;
          return searchTerms ? `${searchTerms} ${dateQuery} newer_than:1y` : `${dateQuery} newer_than:1y`;
        }
      }
    }
  }

  // Handle "month of last year" format
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const lastYearMonthRegex = new RegExp(`(${months.join('|')})\\s+(?:of\\s+)?last\\s+year`, 'i');
  const lastYearMatch = lowerQuery.match(lastYearMonthRegex);
  
  if (lastYearMatch?.length >= 2) {
    const monthName = lastYearMatch[1];
    if (monthName) {
      const monthIndex = months.indexOf(monthName.toLowerCase());
      
      if (monthIndex !== -1) {
        const year = currentYear - 1;
        const startDate = new Date(year, monthIndex, 1);
        const endDate = new Date(year, monthIndex + 1, 1);
        
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          const startStr = startDate.toISOString().split('T')[0].replace(/-/g, '/');
          const endStr = endDate.toISOString().split('T')[0].replace(/-/g, '/');
          const matchedText = lastYearMatch[0];
          if (matchedText) {
            searchTerms = searchTerms.replace(matchedText, '').trim();
            // Don't add newer_than for specific month searches
            return searchTerms ? `${searchTerms} after:${startStr} before:${endStr}` : `after:${startStr} before:${endStr}`;
          }
        }
      }
    }
  }

  // Handle specific months and years
  const monthRegex = new RegExp(`(${months.join('|')})\\s+(?:of\\s+)?(\\d{4})`, 'i');
  const monthMatch = lowerQuery.match(monthRegex);
  
  if (monthMatch !== null && monthMatch.length >= 3) {
    const monthName = monthMatch[1];
    const yearStr = monthMatch[2];
    
    if (monthName && yearStr) {
      const monthIndex = months.indexOf(monthName.toLowerCase());
      const year = parseInt(yearStr);
      
      if (monthIndex !== -1 && !isNaN(year)) {
        // Create start and end dates for the specific month
        const startDate = new Date(year, monthIndex, 1);
        const endDate = new Date(year, monthIndex + 1, 1);
        
        // Ensure dates are valid before proceeding
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          const startStr = startDate.toISOString().split('T')[0].replace(/-/g, '/');
          const endStr = endDate.toISOString().split('T')[0].replace(/-/g, '/');
          const matchedText = monthMatch[0];
          if (matchedText) {
            searchTerms = searchTerms.replace(matchedText, '').trim();
            // Don't add newer_than for specific month searches
            return searchTerms ? `${searchTerms} after:${startStr} before:${endStr}` : `after:${startStr} before:${endStr}`;
          }
        }
      }
    }
  }

  // Handle specific date formats (YYYY/MM/DD, YYYY-MM-DD)
  const dateRegex = /(\d{4}[-/]\d{2}[-/]\d{2})/g;
  const dates = lowerQuery.match(dateRegex);
  if (dates) {
    // Convert any - to / for Gmail format
    const formattedDates = dates.map(d => d.replace(/-/g, '/'));
    const dateQuery = lowerQuery.includes('before') ? `before:${formattedDates[0]}` :
                     lowerQuery.includes('after') ? `after:${formattedDates[0]}` :
                     formattedDates.length === 2 ? `after:${formattedDates[0]} before:${formattedDates[1]}` :
                     `after:${formattedDates[0]} before:${formattedDates[0]}`;
    
    // Remove the date from the search terms
    searchTerms = searchTerms.replace(/\d{4}[-/]\d{2}[-/]\d{2}/g, '').trim();
    return searchTerms ? `${searchTerms} ${dateQuery}` : dateQuery;
  }

  // Handle relative dates
  const relativeMatch = lowerQuery.match(/(older|newer) than (\d+) (day|week|month|year)s?/i);
  if (relativeMatch && relativeMatch[1] && relativeMatch[2] && relativeMatch[3]) {
    const [fullMatch, type, num, unit] = relativeMatch;
    if (type && unit) {
      const suffix = unit.charAt(0).toLowerCase();
      const operator = type.toLowerCase() === 'older' ? 'older_than' : 'newer_than';
      searchTerms = searchTerms.replace(fullMatch, '').trim();
      return searchTerms ? `${searchTerms} ${operator}:${num}${suffix}` : `${operator}:${num}${suffix}`;
    }
  }

  // Handle common date phrases
  const dateMap = {
    'last week': 'newer_than:7d',
    'last month': 'newer_than:30d',
    'last year': `after:${currentYear-1}/01/01 before:${currentYear}/01/01`,
    'yesterday': 'newer_than:2d older_than:1d',
    'today': 'newer_than:1d',
    'this week': 'newer_than:7d',
    'this month': 'newer_than:30d',
    'this year': `after:${currentYear}/01/01`
  };

  for (const [phrase, operator] of Object.entries(dateMap)) {
    if (lowerQuery.includes(phrase)) {
      // Remove the date phrase but preserve other search terms
      searchTerms = searchTerms.replace(new RegExp(phrase, 'i'), '').trim();
      
      // If the query contains "from", make sure it's preserved
      if (lowerQuery.includes('from')) {
        const fromMatch = searchTerms.match(/from\s+(\S+)/i);
        if (fromMatch && fromMatch[0]) {
          const fromTerm = fromMatch[0];
          searchTerms = searchTerms.replace(fromMatch[0], '').trim();
          return `${fromTerm} ${searchTerms} ${operator}`.trim();
        }
      }
      
      return searchTerms ? `${searchTerms} ${operator}` : operator;
    }
  }

  return query;
}

export async function enhanceSearchQuery(query: string) {
  try {
    // Check authentication
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return {
        enhancedQuery: query,
        error: 'Unauthorized'
      };
    }

    if (!query) {
      return {
        enhancedQuery: '',
        error: 'Query is required'
      };
    }

    // Convert natural language to Gmail search operators
    const enhancedQuery = convertToGmailSearch(query.trim());

    return {
      enhancedQuery,
      error: null
    };
  } catch (error) {
    console.error('Search error:', error);
    return {
      enhancedQuery: query,
      error: error instanceof Error ? error.message : 'Failed to process search query'
    };
  }
}
