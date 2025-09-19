import { McpServer, McpTool, McpToolStream, McpBinary } from 'mcp-sdk';
import { z } from 'zod';
import { config } from 'dotenv';
import OpenAI from 'openai';

// Load environment variables from .env file
config();

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const openAIApiKey = process.env.OPENAI_API_KEY;

if (!openAIApiKey) {
  throw new Error("OPENAI_API_KEY is not defined in the environment variables.");
}

const openai = new OpenAI({ apiKey: openAIApiKey });

// Define the input schema for the tool
const medicalExamInputSchema = z.object({
  examFile: McpBinary.schema.describe("The binary file of the medical exam (e.g., PDF, JPG, PNG)."),
  examType: z.string().describe("The type of medical exam (e.g., 'x-ray', 'blood test', 'MRI scan')."),
});

// Define the output schema for the tool
const medicalExamOutputSchema = z.object({
  probability: z.number().min(0).max(1).describe("A probability score between 0 and 1 indicating the likelihood that the file matches the specified exam type."),
  confidence: z.enum(["high", "medium", "low"]).describe("The confidence level of the verification."),
  reasoning: z.string().describe("An explanation for the verification result."),
});

// Implement the tool logic
const medicalExamVerifierTool: McpTool<typeof medicalExamInputSchema, typeof medicalExamOutputSchema> = {
  name: 'verify_medical_exam',
  description: 'Verifies if a given file is a medical exam of a specific type and returns a probability score.',
  inputSchema: medicalExamInputSchema,
  outputSchema: medicalExamOutputSchema,
  async run(input: z.infer<typeof medicalExamInputSchema>, stream: McpToolStream<typeof medicalExamOutputSchema>) {
    try {
      stream.progress('Analyzing the provided medical document...');

      const base64Image = Buffer.from(input.examFile.buffer).toString('base64');
      const dataUrl = `data:${input.examFile.contentType};base64,${base64Image}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert medical document analyst. Your task is to determine if the provided image is a specific type of medical exam. Respond with a JSON object containing 'probability' (a number 0-1), 'confidence' ('high', 'medium', or 'low'), and 'reasoning' (a brief explanation)."
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Is this document a(n) "${input.examType}"?` },
              {
                type: "image_url",
                image_url: {
                  "url": dataUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 300,
        response_format: { type: "json_object" },
      });

      const messageContent = response.choices[0]?.message?.content;

      if (!messageContent) {
        throw new Error('No content in OpenAI response.');
      }

      const parsedResult = JSON.parse(messageContent);
      const validation = medicalExamOutputSchema.safeParse(parsedResult);

      if (!validation.success) {
         throw new Error(`Invalid response format from the model: ${validation.error.message}`);
      }
      
      stream.progress('Analysis complete. Returning results.');
      stream.end(validation.data);

    } catch (error) {
      console.error('Error during medical exam verification:', error);
      stream.error(new Error('Failed to verify the medical exam due to an internal error.'));
    }
  },
};

// Create and start the MCP server
const server = new McpServer({
  port: port,
  tools: [medicalExamVerifierTool],
  // You can add authentication here if needed
  // auth: (token) => { ... } 
});

server.start().then(() => {
  console.log(`MCP server is running on port ${port}`);
}).catch(error => {
    console.error("Failed to start MCP server:", error);
});
