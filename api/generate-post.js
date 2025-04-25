// File: api/generate-post.js
import OpenAI from 'openai';

// Initialize OpenAI client using the environment variable
// Ensure OPENAI_API_KEY is set in your Vercel project settings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define the serverless function handler
export default async function handler(request, response) {
  // 1. Check if the method is POST
  if (request.method !== 'POST') {
    response.setHeader('Allow', ['POST']);
    return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
  }

  // 2. Get userMessage from the request body
  let userMessage;
  try {
    // Vercel automatically parses JSON body for POST requests
    userMessage = request.body?.userMessage;
  } catch (error) {
    console.error('Error parsing request body:', error);
    return response.status(400).json({ error: 'Invalid request body. Expecting JSON.' });
  }

  // 3. Validate input
  if (!userMessage || typeof userMessage !== 'string' || userMessage.trim() === '') {
    return response.status(400).json({ error: 'Missing or invalid userMessage in request body.' });
  }

  // 4. Check for API Key (essential for the function to work)
  if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY environment variable not set.');
      return response.status(500).json({ error: 'Server configuration error.' });
  }

  // 5. Construct the prompt for OpenAI
  const prompt = `
    Lav et kort, fængende og professionelt opslag til sociale medier (Facebook/Instagram) for en lokal butik baseret på følgende besked fra butikken. Inkluder relevante emojis og 2-4 relevante danske hashtags. Svar kun med selve opslagsteksten, uden ekstra formatering eller introduktion.

    Besked fra butik: "${userMessage}"
  `;

  // 6. Call OpenAI API
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview", // Or "gpt-3.5-turbo" for faster/cheaper results
      messages: [
        { role: "system", content: "Du er en hjælpsom assistent, der skriver SoMe-opslag for lokale butikker." },
        { role: "user", content: prompt }
      ],
      max_tokens: 150, // Limit response length
      temperature: 0.7, // Balance creativity and predictability
    });

    const generatedText = completion.choices[0]?.message?.content?.trim();

    if (!generatedText) {
        throw new Error('OpenAI returned an empty response.');
    }

    // 7. Return successful response
    return response.status(200).json({ result: generatedText });

  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    // Provide a generic error message to the client
    return response.status(500).json({ error: 'Failed to generate post due to an internal error.' });
  }
}