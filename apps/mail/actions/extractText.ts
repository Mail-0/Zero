"use server";
import * as cheerio from 'cheerio';

export async function extractTextFromHTML(decodedBody: string): Promise<string> {
  try {
    // Load HTML into cheerio
    const $ = cheerio.load(decodedBody);

    // Remove script and style elements
    $('script').remove();
    $('style').remove();

    // Get text content and clean it up
    const textOnly = $('body')
      .text()
      .replace(/\r?\n|\r/g, ' ') // Remove line breaks
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();

    return textOnly;
  } catch (error) {
    console.error("Error extracting text from HTML:", error);
    throw new Error("Failed to extract text from HTML");
  }
}
