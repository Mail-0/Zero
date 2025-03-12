"use server";

import OpenAI from "openai";

let openai_client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function getOpenAIClient() {
  return openai_client;
}
