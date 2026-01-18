import { createTool } from '@mastra/core';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

export const analyzeStationImageTool = createTool({
  id: 'analyze-station-image',
  description: 'Analyze an image of a charging station to identify problems, error codes, or connector issues. Useful when customer sends photos.',
  inputSchema: z.object({
    imageUrl: z.string().describe('URL of the image to analyze'),
    question: z.string().optional().describe('Specific question about the image (optional)'),
  }),
  execute: async ({ context }) => {
    try {
      const { imageUrl, question } = context;

      const prompt = question 
        ? `Analyze this charging station image and answer: ${question}`
        : `Analyze this charging station image. Identify:
1. Any visible error messages or codes
2. Connector type and condition
3. Screen display status
4. Any obvious damage or issues
5. Station identification numbers
Provide a detailed analysis in Hebrew.`;

      const result = await generateText({
        model: openai('gpt-4o'),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image', image: imageUrl },
            ],
          },
        ],
      });

      return {
        success: true,
        analysis: result.text,
        imageUrl,
      };
    } catch (error) {
      console.error('Image analysis tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze image',
      };
    }
  },
});
