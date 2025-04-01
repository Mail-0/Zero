'use server'

import OpenAI from 'openai';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    if (!process.env.OPENAI_API_KEY) {
      return {
        enhancedQuery: query,
        error: 'OpenAI API key is not configured'
      };
    }

    const systemPrompt = `You are an email search query enhancer. Your job is to convert natural language queries into precise email search queries.

Rules:
1. Focus on the main term first
2. Only include secondary terms if explicitly mentioned
3. Avoid generic terms that could dilute the search
4. Use exact matches when possible
5. Keep the query simple and focused

Examples:
- "find that sls legal email" → "subject:sls OR from:sls"
- "sls legal documents" → "subject:sls OR from:sls has:attachment"
- "emails between maha and fadi" → "(from:maha OR to:maha OR subject:maha) AND (from:fadi OR to:fadi OR subject:fadi)"
- "maha fadi project" → "(from:maha OR to:maha OR subject:maha) AND (from:fadi OR to:fadi OR subject:fadi) subject:project"
- "emails about project deadline from last week" → "subject:project subject:deadline after:${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} before:${new Date().toISOString().split('T')[0]}"

Convert this query into a precise email search query: "${query}"`;

    console.log('Enhancing search query:', query);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{
        role: "system",
        content: systemPrompt
      }],
      temperature: 0.2,
      max_tokens: 100,
    });

    const aiResponse = completion.choices[0]?.message?.content;
    console.log('AI Response:', aiResponse);
    
    const enhancedQuery = aiResponse?.trim() || query;
    console.log('Enhanced Query:', enhancedQuery);

    if (!enhancedQuery) {
      return {
        enhancedQuery: query,
        error: 'Failed to generate search query'
      };
    }

    return {
      enhancedQuery,
      error: null
    };
  } catch (error) {
    console.error('AI Search error:', error);
    return {
      enhancedQuery: query,
      error: error instanceof Error ? error.message : 'Failed to enhance search query'
    };
  }
}
