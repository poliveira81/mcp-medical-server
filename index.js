import express from 'express';
// Note: The package name is @mcp/sdk as per the latest package.json
import { McpServer, McpTool } from '@mcp/sdk';
import { v4 as uuidv4 } from 'uuid';

const port = process.env.PORT || 3000;
const app = express();

// This entire block related to the API key is now commented out.
// const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
//
// if (!OPENAI_API_KEY) {
//   console.error("OPENAI_API_KEY environment variable is not set.");
//   process.exit(1);
// }

class MedicalExamVerifierTool extends McpTool {
  constructor() {
    super();
    this.name = 'medical_exam_verifier';
    this.description = 'Verifies if a file is a specific type of medical exam';
    this.inputs = {
      file: {
        type: 'file',
        description: 'The medical exam file (e.g., PDF, JPG, PNG)',
        required: true,
      },
      examType: {
        type: 'string',
        description: 'The type of medical exam (e.g., "x-ray", "blood test report")',
        required: true,
      },
    };
    this.outputs = {
      probability: {
        type: 'number',
        description: 'A probability score (0 to 1) of the file matching the exam type.',
      },
      is_verified: {
        type: 'boolean',
        description: 'True if the file is verified to be of the specified type, false otherwise.',
      },
      reasoning: {
        type: 'string',
        description: 'An explanation of the verification result.',
      },
    };
  }

  async execute(inputs, context) {
    console.log("Executing tool with inputs:", inputs);
    const { file, examType } = inputs;

    if (!file || !file.data || !examType) {
      return {
        probability: 0,
        is_verified: false,
        reasoning: 'Error: Missing file data or exam type in the input.',
      };
    }

    const fileContent = Buffer.from(file.data, 'base64');
    console.log(`Received file of size ${fileContent.length} bytes for exam type: ${examType}`);

    // --- MOCK IMPLEMENTATION (No API Key Needed) ---
    // Simulating a delay and returning a random result for testing.
    console.log("Using mock implementation. Simulating analysis...");
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network/analysis delay

    const randomProbability = Math.random();
    const isVerified = randomProbability > 0.5;
    const mockReasoning = `This is a mock response. The analysis was simulated. The file appears ${isVerified ? 'to be' : 'not to be'} a valid '${examType}' document.`;
    
    const result = {
        probability: randomProbability,
        is_verified: isVerified,
        reasoning: mockReasoning
    };

    console.log("Mock result:", result);
    return result;

    /*
    // --- REAL IMPLEMENTATION (Requires OpenAI API Key) ---
    // When you are ready, uncomment this block and remove the mock implementation above.

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze the attached image/document. Is this a medical exam of the type "${examType}"? Respond with a JSON object containing three fields: "probability" (a float from 0.0 to 1.0 indicating your confidence), "is_verified" (a boolean), and "reasoning" (a brief explanation).`
                },
                {
                  type: "image_url",
                  image_url: {
                    "url": `data:${file.mediaType};base64,${file.data}`
                  }
                }
              ]
            }
          ],
          max_tokens: 300
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${errorBody}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Clean up the response from the model
      const jsonString = content.replace(/```json\n|\n```/g, '').trim();
      const result = JSON.parse(jsonString);

      console.log("OpenAI analysis result:", result);
      return result;

    } catch (error) {
      console.error("Error during OpenAI API call:", error);
      return {
        probability: 0,
        is_verified: false,
        reasoning: `An error occurred during analysis: ${error.message}`
      };
    }
    */
  }
}

const server = new McpServer();
const medicalTool = new MedicalExamVerifierTool();
server.registerTool('medical_exam_verifier', medicalTool);

app.use(express.json({ limit: '50mb' })); // Increased limit for larger files
app.post('/mcp', server.createExpressHandler());

app.listen(port, () => {
  console.log(`MCP server listening on port ${port}`);
});

