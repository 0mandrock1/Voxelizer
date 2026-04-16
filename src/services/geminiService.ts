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
            text: `You are a Hybrid 3D Voxel Artist and Architect. Your goal is to reconstruct the object in the image as a high-fidelity 3D model (max 32x32x32) that balances structural integrity with intricate surface detail.

### CORE STRATEGY: STRUCTURAL FOUNDATION
- **Geometric Primitives**: First, identify the core structure (planes, cylinders, lines). Align these to the X, Y, and Z axes for stability.
- **Axis Alignment**: Ensure vertical elements (legs, walls) are perfectly aligned to the Z-axis.
- **Manifold Shell**: Build a solid outer shell. Avoid "holes" unless they are part of the object's design.

### DETAIL STRATEGY: SURFACE & TEXTURE
- **Intricate Patterns**: If the object has surface patterns (engravings, logos, textures), represent them with 1-voxel precision. Do NOT simplify these into flat colors.
- **Complex Geometry**: For non-geometric parts (ornaments, organic shapes), use a higher density of voxels to capture the unique silhouette. Avoid "blocky" approximations for curved or detailed edges.
- **Micro-Detail**: Capture fine features like buttons, wires, or small protrusions as distinct elements.

### COLOR & TEXTURE FIDELITY
- **Adaptive Palette**: Use a minimal base palette for structure, but expand it to capture intricate patterns and material textures.
- **Texture Mapping**: Use color variations to represent physical textures (e.g., the weave of fabric, the grain of wood, or metallic sheen).
- **Clean Contrast**: Ensure patterns are sharp and distinct, not "muddy" or blurred.

### RECONSTRUCTION STEPS:
1. **Skeleton**: Build the primary structural frame.
2. **Surface Shell**: Wrap the frame in a detailed surface layer, capturing all intricate patterns.
3. **Detail Pass**: Add micro-features and refine the silhouette for smoother transitions.
4. **Critique**: Ensure the model isn't overly simplified; if a pattern is visible in the image, it must be visible in the voxels.

### OUTPUT SPECIFICATIONS:
Return a JSON object:
- \`width\`, \`height\`, \`depth\`: Integers (max 32).
- \`voxels\`: Array of \`{x, y, z, colorIndex}\`.
- \`palette\`: Array of exactly 256 \`{r, g, b, a}\` objects. Index 0 is transparent {0,0,0,0}.

### CONSTRAINTS:
- Target voxel count: 1200-2200 for complex objects.
- Output ONLY the JSON object.`,
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
