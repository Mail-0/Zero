"use server";

export async function extractTextFromHTML(decodedBody: string): Promise<string> {
  try {
    const textOnly = decodedBody.replace(/<[^>]*>?/gm, "");

    return textOnly.trim();
  } catch (error) {
    console.error("Error extracting text from HTML:", error);

    throw new Error("Failed to extract text from HTML");
  }
}
