import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface VoxelData {
  width: number;
  height: number;
  depth: number;
  voxels: { x: number; y: number; z: number; colorIndex: number }[];
  palette: { r: number; g: number; b: number; a: number }[];
}

export async function generateVoxelFromImage(base64Image: string, mimeType: string): Promise<VoxelData> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            text: `Analyze this image and convert it into a 3D voxel model. 
            The output must be a JSON object representing a voxel grid (max 32x32x32).
            
            Return a JSON object with:
            - width, height, depth (integers, max 32)
            - voxels: array of {x, y, z, colorIndex}. colorIndex should be 1-based (1 to 255).
            - palette: array of 256 {r, g, b, a} objects. Index 0 is reserved for empty space (but you should provide 256 entries, where index 0 is usually black/transparent).
            
            Try to capture the main shape and colors of the object in the image. 
            If it's a 2D image, try to give it some depth (e.g., 2-5 voxels thick) or interpret it as a 3D object if possible.
            
            IMPORTANT: The response MUST be ONLY the JSON object.`,
          },
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          width: { type: Type.INTEGER },
          height: { type: Type.INTEGER },
          depth: { type: Type.INTEGER },
          voxels: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.INTEGER },
                y: { type: Type.INTEGER },
                z: { type: Type.INTEGER },
                colorIndex: { type: Type.INTEGER },
              },
              required: ["x", "y", "z", "colorIndex"],
            },
          },
          palette: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                r: { type: Type.INTEGER },
                g: { type: Type.INTEGER },
                b: { type: Type.INTEGER },
                a: { type: Type.INTEGER },
              },
              required: ["r", "g", "b", "a"],
            },
          },
        },
        required: ["width", "height", "depth", "voxels", "palette"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");
  
  return JSON.parse(text) as VoxelData;
}
