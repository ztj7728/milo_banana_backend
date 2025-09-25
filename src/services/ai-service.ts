import { GoogleGenAI } from "@google/genai";
import { database } from '../database';

export interface InlineData {
  mimeType: string;
  data: string;
}

export interface PromptPart {
  text?: string;
  inlineData?: InlineData;
}

export interface GeneratedContent {
  text?: string;
  imageData?: string;
}

export interface AIServiceConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export abstract class BaseAIService {
  abstract generateContent(promptParts: PromptPart[], config: AIServiceConfig): Promise<GeneratedContent[]>;
}

export class GeminiService extends BaseAIService {
  async generateContent(promptParts: PromptPart[], config: AIServiceConfig): Promise<GeneratedContent[]> {
    const ai = new GoogleGenAI({
      apiKey: config.apiKey,
      httpOptions: { baseUrl: config.baseUrl }
    });

    const response = await ai.models.generateContent({
      model: config.model,
      contents: promptParts
    });

    const parts = response.candidates?.[0]?.content?.parts;
    const results: GeneratedContent[] = [];

    if (parts) {
      for (const part of parts) {
        const content: GeneratedContent = {};

        if (part.text) {
          content.text = part.text;
        }

        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          content.imageData = `data:${mimeType};base64,${part.inlineData.data}`;
        }

        if (content.text || content.imageData) {
          results.push(content);
        }
      }
    }

    return results;
  }
}

export class OpenAIService extends BaseAIService {
  async generateContent(promptParts: PromptPart[], config: AIServiceConfig): Promise<GeneratedContent[]> {
    // Placeholder for future OpenAI implementation
    throw new Error('OpenAI service not yet implemented');
  }
}

export type SupportedPlatform = 'gemini' | 'openai';

export class AIServiceFactory {
  static createService(platform: SupportedPlatform): BaseAIService {
    switch (platform) {
      case 'gemini':
        return new GeminiService();
      case 'openai':
        return new OpenAIService();
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  static async generateContent(platform: SupportedPlatform, promptParts: PromptPart[]): Promise<GeneratedContent[]> {
    const service = this.createService(platform);
    const config = await database.getConfig();
    return service.generateContent(promptParts, config);
  }
}