import { GoogleGenAI, Chat, GenerateContentResponse, Type } from "@google/genai";
import { Ticket, ChatMode, AspectRatio, GroundingChunk, Slide } from "../types";

// Configuration for different modes
const MODELS = {
  assistant: 'gemini-3-pro-preview', // Complex tasks, context aware
  explorer: 'gemini-2.5-flash',      // Maps grounding
  artist: 'gemini-3-pro-image-preview', // Image generation
  blitz: 'gemini-2.5-flash-lite',    // Low latency
};

export class GeminiAssistant {
  private ai: GoogleGenAI;
  // Store separate chat sessions for text-based modes to maintain distinct histories
  private sessions: Map<string, Chat> = new Map();

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  // Helper to get or create a session for a specific mode
  private getSession(mode: ChatMode, tickets: Ticket[], systemPromptOverride?: string): Chat {
    if (this.sessions.has(mode)) {
      return this.sessions.get(mode)!;
    }

    const systemInstruction = systemPromptOverride || this.getSystemInstruction(mode, tickets);
    
    // Tools configuration
    const tools: any[] = [];
    if (mode === 'explorer') {
      tools.push({ googleMaps: {} });
    }

    const chat = this.ai.chats.create({
      model: MODELS[mode] || MODELS.assistant,
      config: {
        systemInstruction,
        tools: tools.length > 0 ? tools : undefined,
      },
    });

    this.sessions.set(mode, chat);
    return chat;
  }

  private getSystemInstruction(mode: ChatMode, tickets: Ticket[]): string {
    const ticketSummary = tickets.map(t => 
      `- [${t.status}] ${t.title} (Priority: ${t.priority}, Due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'None'})`
    ).join('\n');

    const baseContext = `Current Date: ${new Date().toLocaleDateString()}\nUser's Tasks:\n${ticketSummary}`;

    switch (mode) {
      case 'explorer':
        return "You are a helpful travel and location assistant. Use Google Maps to find places mentioned by the user.";
      case 'blitz':
        return `You are a super-fast, concise assistant. Give 1-sentence answers. Context: ${baseContext}`;
      case 'assistant':
      default:
        return `You are an intelligent project manager. Use the task list to answer questions. Context: ${baseContext}`;
    }
  }

  // Generate slides for the "Magic Presentation" feature
  public async generatePresentation(content: string): Promise<Slide[]> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview', // Use Flash for speed in restructuring
        contents: `Convert the following notes into a structured presentation deck. Return JSON only.
        
        Notes:
        ${content}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                content: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ['title', 'content']
            }
          }
        }
      });
      
      const slides = JSON.parse(response.text || "[]");
      // Ensure IDs exist
      return slides.map((s: any, i: number) => ({
        ...s,
        id: s.id || `slide-${Date.now()}-${i}`
      }));
    } catch (e) {
      console.error("Presentation generation failed", e);
      return [];
    }
  }

  // Main entry point for sending messages (Streaming)
  public async *streamMessage(
    message: string, 
    mode: ChatMode, 
    tickets: Ticket[],
    options?: {
      aspectRatio?: AspectRatio,
      location?: { lat: number, lng: number }
    }
  ): AsyncGenerator<{ text: string, image?: string, grounding?: GroundingChunk[] }> {
    
    // IMAGE GENERATION (Artist Mode) - No streaming for images yet, yield once
    if (mode === 'artist') {
      const freshAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
      try {
        const response = await freshAI.models.generateContent({
          model: MODELS.artist,
          contents: { parts: [{ text: message }] },
          config: {
            imageConfig: {
              aspectRatio: options?.aspectRatio || "1:1",
              imageSize: "1K" 
            }
          }
        });

        let text = "";
        let image = undefined;

        if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              image = part.inlineData.data;
            } else if (part.text) {
              text += part.text;
            }
          }
        }
        yield { text: text || "Here is your generated image.", image };
        return;

      } catch (e: any) {
        console.error("Image Gen Error:", e);
        if (e.message?.includes("API key")) {
           throw new Error("API_KEY_REQUIRED");
        }
        throw new Error("Failed to generate image.");
      }
    }

    // MAPS / EXPLORER MODE - Using generateContentStream
    if (mode === 'explorer') {
       const tools = [{ googleMaps: {} }];
       const toolConfig = options?.location ? {
         retrievalConfig: {
           latLng: {
             latitude: options.location.lat,
             longitude: options.location.lng
           }
         }
       } : undefined;

       const result = await this.ai.models.generateContentStream({
         model: MODELS.explorer,
         contents: message,
         config: {
           tools,
           toolConfig,
           systemInstruction: "You are a location assistant. Find places."
         }
       });

       let accumulatedText = "";
       for await (const chunk of result) {
         accumulatedText += chunk.text;
         const grounding = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
         yield { text: accumulatedText, grounding };
       }
       return;
    }

    // TEXT MODES (Assistant, Blitz) - Using chat.sendMessageStream
    const session = this.getSession(mode, tickets);
    try {
      const result = await session.sendMessageStream({ message });
      let accumulatedText = "";
      
      for await (const chunk of result) {
        accumulatedText += chunk.text;
        yield { text: accumulatedText };
      }
    } catch (error) {
      console.error("Chat Error", error);
      throw new Error("AI service unavailable.");
    }
  }
}

export const geminiService = new GeminiAssistant();
