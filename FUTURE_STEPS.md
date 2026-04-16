# Future Prompting Improvements

Based on the current progress and user feedback, here are the key areas for future voxel generation prompt refinements:

### 1. Advanced Structural Constraints
- **Symmetry Detection**: Explicitly instruct the AI to detect and enforce bilateral or radial symmetry (e.g., for chairs, wheels, or characters).
- **Proportional Verification**: Add a step to compare the generated model's aspect ratio with the source image to prevent stretching or squashing.

### 2. Enhanced Material Semantics
- **Sub-Material Identification**: Allow the AI to identify multiple materials within a single object (e.g., "leather seat with metal legs") and apply specific voxelization rules to each part.
- **Transparency Handling**: Improve instructions for semi-transparent materials (glass, plastic) using alpha-channel palette optimization.

### 3. Lighting & Shading Awareness
- **Ambient Occlusion Simulation**: Instruct the AI to darken voxels in crevices and joints to add depth and realism without increasing voxel count.
- **Shadow Directionality**: Use shadow cues in the image to better understand 3D form, but ignore cast shadows on the ground.

### 4. Voxel-Specific Art Styles
- **Brutalist/Blocky**: A mode that emphasizes large, solid volumes.
- **Filigree/Intricate**: A mode optimized for thin, wire-like structures.
- **Organic/Smooth**: Improved instructions for rounded, non-geometric forms using dithering-like color patterns.

### 5. Multi-View Synthesis (Future)
- If multiple images are provided, the prompt should be updated to synthesize a single 3D model by cross-referencing different angles.
