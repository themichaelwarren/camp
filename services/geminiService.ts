
import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface AIPromptResponse {
  title: string;
  description: string;
  tags: string[];
}

export interface AILyricAnalysis {
  emotionalResonance: string;
  imageryFeedback: string;
  structuralSuggestions: string;
  suggestedThemes: string[];
}

export const generateCreativePrompt = async (theme?: string): Promise<AIPromptResponse> => {
  const ai = getAI();
  const promptText = theme 
    ? `Generate a creative songwriting prompt based on the theme: "${theme}".`
    : "Generate a unique, inspiring creative songwriting prompt for an internal songwriting camp.";

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: promptText,
    config: {
      systemInstruction: "You are a world-class songwriting coach at a high-end creative retreat. Your prompts are evocative, specific, and designed to break writer's block. Return the response in JSON format.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "A catchy, evocative title for the prompt." },
          description: { type: Type.STRING, description: "A detailed 2-3 sentence explanation of the creative challenge." },
          tags: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "3-4 keywords related to the vibe or genre (e.g., 'Melancholic', 'Synth-pop', 'Acoustic')."
          },
        },
        required: ["title", "description", "tags"],
      },
    },
  });

  try {
    return JSON.parse(response.text || '{}') as AIPromptResponse;
  } catch (e) {
    console.error("Failed to parse AI response", e);
    throw new Error("Invalid AI response");
  }
};

export const analyzeLyrics = async (lyrics: string, title: string): Promise<AILyricAnalysis> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze these lyrics for a song titled "${title}":\n\n${lyrics}`,
    config: {
      systemInstruction: "You are an expert music producer and A&R scout. Provide constructive, insightful feedback on song lyrics. Focus on emotional impact, lyrical imagery, and structural flow. Return the response in JSON format.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          emotionalResonance: { type: Type.STRING, description: "Analysis of the song's emotional core." },
          imageryFeedback: { type: Type.STRING, description: "Feedback on the sensory details and metaphors used." },
          structuralSuggestions: { type: Type.STRING, description: "Suggestions for improving verses, choruses, or bridge structure." },
          suggestedThemes: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Tags for the primary themes discovered in the lyrics."
          },
        },
        required: ["emotionalResonance", "imageryFeedback", "structuralSuggestions", "suggestedThemes"],
      },
    },
  });

  try {
    return JSON.parse(response.text || '{}') as AILyricAnalysis;
  } catch (e) {
    console.error("Failed to parse AI analysis", e);
    throw new Error("Invalid AI analysis");
  }
};
