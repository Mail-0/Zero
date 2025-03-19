import { env } from "@/env";

interface AIResponse {
  id: string;
  content: string;
  type: 'email' | 'question' | 'system';
  position?: 'start' | 'end' | 'replace';
}

// Define user context type
interface UserContext {
  name?: string;
  email?: string;
}

const conversationHistories: Record<string, {role: 'user' | 'assistant' | 'system', content: string}[]> = {};

export const generateConversationId = (): string => {
  return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};


export async function generateEmailContent(
  prompt: string,
  currentContent?: string,
  recipients?: string[],
  conversationId?: string,
  userContext?: UserContext
): Promise<AIResponse[]> {
  try {
    // Get or initialize conversation
    const convId = conversationId || generateConversationId();
    if (!conversationHistories[convId]) {
      conversationHistories[convId] = [
        { role: 'system', content: env.AI_SYSTEM_PROMPT || 'You are an email assistant.' }
      ];
      
      // Add user context if available
      if (userContext?.name) {
        conversationHistories[convId].push({
          role: 'system',
          content: `User name: ${userContext.name}. Always sign emails with ${userContext.name}.`
        });
      }
    }
    
    // Add user message to history
    conversationHistories[convId].push({ role: 'user', content: prompt });
    
    // Check if this is a question about the email
    const isQuestion = checkIfQuestion(prompt);
    
    // Prepare messages for API call
    const messages = [...conversationHistories[convId]];
    
    // Add context about current email if it exists
    if (currentContent) {
      messages.push({
        role: 'system',
        content: `The user's current email draft is:\n\n${currentContent}`
      });
    }
    
    // Add context about recipients
    if (recipients && recipients.length > 0) {
      messages.push({
        role: 'system',
        content: `The email is addressed to: ${recipients.join(', ')}`
      });
    }
    
    // Make API call to OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages,
        temperature: 0.7,
        max_tokens: isQuestion ? 150 : 1000,
        top_p: 1
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    const generatedContent = data.choices[0].message.content;
    
    // Add assistant response to conversation history
    conversationHistories[convId].push({ role: 'assistant', content: generatedContent });
    
    // Format and return the response
    if (isQuestion) {
      return [{
        id: "question-" + Date.now(),
        content: generatedContent,
        type: "question",
        position: "replace"
      }];
    } else {
      // Format email content
      const formattedContent = formatEmailContent(generatedContent, prompt, recipients);
      
      return [{
        id: "email-" + Date.now(),
        content: formattedContent,
        type: "email",
        position: "replace"
      }];
    }
  } catch (error) {
    console.error("Error generating email content:", error);
    throw error;
  }
}

function formatEmailContent(content: string, prompt: string, recipients?: string[]): string {
  // Remove any "Subject:" line at the beginning
  let formattedContent = content
    .replace(/^Subject:.*?(\n|$)/i, '')
    .replace(/^\*\*Subject:.*?\*\*(\n|$)/i, '');
  
  // Clean up the content
  formattedContent = formattedContent.trimStart()
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map(line => line.trimRight()).join('\n')
    .trim();
  
  return formattedContent;
}


function checkIfQuestion(prompt: string): boolean {
  const trimmedPrompt = prompt.trim().toLowerCase();
  
  // Check if the prompt ends with a question mark
  if (trimmedPrompt.endsWith('?')) return true;
  
  // Check if the prompt starts with question words
  const questionStarters = [
    'what', 'how', 'why', 'when', 'where', 'who', 
    'can you', 'could you', 'would you', 'will you',
    'is it', 'are there', 'should i', 'do you'
  ];
  
  return questionStarters.some(starter => trimmedPrompt.startsWith(starter));
} 