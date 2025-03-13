"use server";

import { getOpenAIClient } from "@/lib/openai";
import OpenAI from "openai";

type AIRequestPayload = {
  prompt: string;
  selection: string;
};

/**
 * Generates an AI edit for the provided text based on the user's prompt
 *
 * @param payload The request payload containing the prompt and selection
 * @returns A JSON object with the edited text
 */
export async function generateInlineAIEdit(
  payload: AIRequestPayload,
): Promise<{ data: string } | { error: string }> {
  const openai_client = await getOpenAIClient();
  if (openai_client == null)
    return { error: "OpenAI client not instantiated. Check API key configuration." };

  try {
    const { prompt, selection } = payload;

    if (!prompt) {
      return { error: "Prompt is required" };
    }
    // Prepare the message with instructions for the AI
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          'You are an email editor. The user will provide you with a line of text you need to edit, called \'selection\', and your task is to update the selection according to the user\'s request. Reply with a JSON object containing the edited text in the format: {"edit": "edited text"}',
      },
      {
        role: "user",
        content: `Here is the selection:\n${selection}\nHere is the prompt:\n${prompt}`,
      },
    ];

    const response = await openai_client.chat.completions.create({
      model: "gpt-3.5-turbo-0125",
      messages: messages,
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const editedText = response.choices[0]?.message?.content?.trim() || "";
    let JSONParsedText;

    // Ensure we have a valid JSON response
    try {
      JSONParsedText = JSON.parse(editedText);
    } catch (jsonError) {
      console.error("Error parsing AI response as JSON:", jsonError);
      return { error: "AI response was not valid JSON" };
    }

    return { data: JSONParsedText };
  } catch (error) {
    console.error("Error generating AI edit:", error);
    return { error: error instanceof Error ? error.message : "Failed to generate AI edit" };
  }
}
