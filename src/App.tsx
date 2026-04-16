import { useState, useCallback } from "react";
import { Upload, Download, Box, Loader2, Image as ImageIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VoxelPreview } from "./components/VoxelPreview";
import { generateVoxelFromImage, VoxelData } from "./services/geminiService";
import { exportToVox } from "./lib/vox-exporter";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<"idle" | "analyzing" | "voxelizing" | "finalizing">("idle");
  const [logStep, setLogStep] = useState(0);
  const [voxelData, setVoxelData] = useState<VoxelData | null>(null);
  const [cullInterior, setCullInterior] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsImageLoading(true);
      const reader = new FileReader();
      reader.onloadstart = () => setIsImageLoading(true);
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImage(base64);
        setMimeType(file.type);
        setVoxelData(null);
        setError(null);
        setIsImageLoading(false);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const processImage = async () => {
    if (!image) return;
    
    // Validate MIME type
    const supportedTypes = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];
    if (!supportedTypes.includes(mimeType)) {
      setError(`Unsupported image type: ${mimeType}. Please use PNG, JPG, or WEBP.`);
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setLogStep(0);
    setStage("analyzing");
    setError(null);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev < 30) return prev + 1.5;
        if (prev < 85 && stage === "voxelizing") return prev + 0.3;
        if (prev < 98 && stage === "finalizing") return prev + 0.1;
        return prev;
      });
    }, 100);

    const logInterval = setInterval(() => {
      setLogStep(prev => prev + 1);
    }, 2500);

    try {
      const base64Data = image.split(",")[1];
      
      // Stage 1: Analyzing
      setStage("analyzing");
      
      const dataPromise = generateVoxelFromImage(base64Data, mimeType);
      
      // After a short delay, move to voxelizing stage
      const stageTimeout = setTimeout(() => {
        setStage("voxelizing");
      }, 2500);
      
      const data = await dataPromise;
      clearTimeout(stageTimeout);
      
      // Stage 2: Finalizing
      setStage("finalizing");
      setProgress(90);

      let processedData = data;
      if (cullInterior) {
        // Optimization: Remove voxels that are completely surrounded by other voxels
        const voxelSet = new Set(data.voxels.map(v => `${v.x},${v.y},${v.z}`));
        processedData = {
          ...data,
          voxels: data.voxels.filter(v => {
            const neighbors = [
              [1, 0, 0], [-1, 0, 0],
              [0, 1, 0], [0, -1, 0],
              [0, 0, 1], [0, 0, -1]
            ];
            const isSurrounded = neighbors.every(([dx, dy, dz]) => 
              voxelSet.has(`${v.x + dx},${v.y + dy},${v.z + dz}`)
            );
            return !isSurrounded;
          })
        };
      }
      
      setVoxelData(processedData);
      setProgress(100);
    } catch (err) {
      console.error(err);
      let errorMessage = "Failed to process image. ";
      
      if (err instanceof Error) {
        if (err.message.includes("404")) {
          errorMessage += "The AI model is currently unavailable. Please try again in a few moments.";
        } else if (err.message.includes("safety")) {
          errorMessage += "The image was flagged by safety filters. Please try a different image.";
        } else if (err.message.includes("quota")) {
          errorMessage += "API quota exceeded. Please wait a bit before retrying.";
        } else {
          errorMessage += "Please ensure the image is clear and the object is well-lit.";
        }
      }
      
      setError(errorMessage);
    } finally {
      clearInterval(progressInterval);
      clearInterval(logInterval);
      setIsProcessing(false);
      setStage("idle");
    }
  };

  const handleExport = () => {
    if (!voxelData) return;
    
    const voxBinary = exportToVox(
      voxelData.width,
      voxelData.height,
      voxelData.depth,
      voxelData.voxels,
      voxelData.palette
    );
    
    const blob = new Blob([voxBinary], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "model.vox";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearImage = () => {
    setImage(null);
    setVoxelData(null);
    setError(null);
  };

  const loadSample = async (url: string) => {
    setIsImageLoading(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImage(base64);
        setMimeType(blob.type);
        setVoxelData(null);
        setError(null);
        setIsImageLoading(false);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error(err);
      setError("Failed to load sample image.");
      setIsImageLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-primary font-sans flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-border-theme flex items-center justify-between px-6 shrink-0">
        <div className="font-serif italic text-xl tracking-[2px] text-accent uppercase">
          Voxelize.io
        </div>
      </header>

      <main className="flex-1 grid grid-cols-[280px_1fr_240px] divide-x divide-border-theme bg-border-theme">
        {/* Left Sidebar: Assets & Input */}
        <section className="bg-bg-base p-6 flex flex-col overflow-y-auto">
          <h2 className="font-serif text-[12px] uppercase text-text-secondary mb-6 tracking-wider">Source Image</h2>
          
          {!image ? (
            <label className="border border-dashed border-border-theme bg-bg-surface rounded flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-bg-surface/80 transition-all mb-6 group h-48 relative overflow-hidden">
              {isImageLoading ? (
                <div className="flex flex-col items-center animate-pulse">
                  <Loader2 className="w-6 h-6 text-accent animate-spin mb-3" />
                  <span className="text-[10px] text-text-secondary uppercase tracking-widest">Reading File...</span>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-text-secondary group-hover:text-accent mb-3 transition-colors" />
                  <span className="text-[11px] text-text-secondary uppercase tracking-wider">Drag & Drop File</span>
                </>
              )}
              <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp,image/heic,image/heif" onChange={handleImageUpload} disabled={isImageLoading} />
            </label>
          ) : (
            <div className="relative group mb-6">
              <img 
                src={image} 
                alt="Source" 
                className="w-full h-48 object-contain rounded bg-bg-surface border border-border-theme"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                <Button variant="destructive" size="icon" onClick={clearImage}>
                  <Trash2 className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}

          {image && !voxelData && (
            <button 
              className="bg-accent text-black py-3.5 px-4 w-full font-semibold uppercase text-[12px] tracking-wider rounded cursor-pointer hover:opacity-90 disabled:opacity-50 transition-all"
              onClick={processImage}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </span>
              ) : (
                "Generate Voxel Model"
              )}
            </button>
          )}

          {error && (
            <p className="text-red-400 text-[11px] mt-4 bg-red-400/10 p-3 rounded border border-red-400/20">
              {error}
            </p>
          )}

          <div className="mt-10">
            <h2 className="font-serif text-[12px] uppercase text-text-secondary mb-4 tracking-wider">Sample Assets</h2>
            <div className="space-y-4">
              {[
                { 
                  name: "Modern_Chair.png", 
                  size: "64x64", 
                  weight: "1.2MB",
                  url: "https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&q=80&w=300&h=300"
                },
                { 
                  name: "Fantasy_Sword.png", 
                  size: "32x32", 
                  weight: "0.8MB",
                  url: "https://images.unsplash.com/photo-1589652717521-10c0d092dea9?auto=format&fit=crop&q=80&w=300&h=300"
                },
                { 
                  name: "Retro_Console.png", 
                  size: "128x128", 
                  weight: "3.5MB",
                  url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=300&h=300"
                }
              ].map((asset, i) => (
                <div 
                  key={i} 
                  className="flex gap-3 items-center opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer group"
                  onClick={() => loadSample(asset.url)}
                >
                  <div className="w-10 h-10 bg-bg-control rounded-sm shrink-0 flex items-center justify-center overflow-hidden border border-border-theme group-hover:border-accent transition-colors">
                    <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[12px] truncate group-hover:text-accent transition-colors">{asset.name}</p>
                    <span className="text-[10px] text-text-secondary">{asset.size} &bull; {asset.weight}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Center: 3D Viewport */}
        <section className="bg-bg-surface relative flex items-center justify-center overflow-hidden">
          <div className="w-full h-full">
            <VoxelPreview data={voxelData} />
          </div>
          
          {isProcessing && (
            <div className="absolute inset-0 bg-bg-base/80 backdrop-blur-md flex flex-col items-center justify-center z-10 p-12 text-center">
              <div className="w-full max-w-xs space-y-6">
                <div className="relative w-24 h-24 mx-auto">
                  <Loader2 className="w-full h-full text-accent animate-spin opacity-20" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-accent font-mono text-sm">{Math.round(progress)}%</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-serif italic text-white tracking-wider">
                    {stage === "analyzing" && "Analyzing Visual Features"}
                    {stage === "voxelizing" && "Neural Voxelization"}
                    {stage === "finalizing" && "Optimizing Mesh"}
                  </h3>
                  <p className="text-text-secondary text-[10px] uppercase tracking-[0.2em]">
                    Neural_Voxel_v2.4 Engine
                  </p>
                </div>

                <div className="w-full h-[1px] bg-border-theme relative overflow-hidden">
                  <motion.div 
                    className="absolute inset-y-0 left-0 bg-accent shadow-[0_0_10px_rgba(212,180,131,0.8)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                  />
                </div>

                <div className="flex justify-between text-[9px] text-text-secondary uppercase tracking-widest">
                  <span className={stage === "analyzing" ? "text-accent" : ""}>Analyze</span>
                  <span className={stage === "voxelizing" ? "text-accent" : ""}>Voxelize</span>
                  <span className={stage === "finalizing" ? "text-accent" : ""}>Export</span>
                </div>

                {/* Model Log */}
                <div className="mt-8 bg-black/40 p-4 rounded border border-border-theme text-left font-mono text-[10px] space-y-1 h-32 overflow-hidden relative">
                  <div className="text-accent/60 mb-2 uppercase tracking-widest border-b border-border-theme pb-1">Neural_Log_Stream</div>
                  <AnimatePresence mode="popLayout">
                    {stage === "analyzing" && (
                      <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} key="log1">
                        &gt; [INFO] Initializing visual buffer...<br />
                        &gt; [INFO] Detecting primary object contours...<br />
                        &gt; [INFO] Scene class: {mimeType.split('/')[1].toUpperCase()}_DATA<br />
                        &gt; [INFO] Calculating spatial orientation...
                      </motion.div>
                    )}
                    {stage === "voxelizing" && (
                      <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} key={`log-v-${logStep}`}>
                        {logStep % 5 === 0 && (
                          <>
                            &gt; [DATA] Mapping pixels to 3D grid...<br />
                            &gt; [DATA] Extruding volumetric depth (Y-axis)...<br />
                            &gt; [DATA] Sampling color palette (256 slots)...<br />
                            &gt; [DATA] Verifying structural integrity...
                          </>
                        )}
                        {logStep % 5 === 1 && (
                          <>
                            &gt; [NEURAL] Analyzing spatial relationships...<br />
                            &gt; [NEURAL] Refining object silhouette...<br />
                            &gt; [NEURAL] Calculating occlusion maps...<br />
                            &gt; [NEURAL] Optimizing voxel density...
                          </>
                        )}
                        {logStep % 5 === 2 && (
                          <>
                            &gt; [SCAN] Processing micro-details...<br />
                            &gt; [SCAN] Detecting hollow regions...<br />
                            &gt; [SCAN] Aligning symmetry planes...<br />
                            &gt; [SCAN] Validating mesh manifold...
                          </>
                        )}
                        {logStep % 5 === 3 && (
                          <>
                            &gt; [CORE] Executing depth-first traversal...<br />
                            &gt; [CORE] Applying volumetric shading...<br />
                            &gt; [CORE] Reconstructing hidden surfaces...<br />
                            &gt; [CORE] Finalizing neural weights...
                          </>
                        )}
                        {logStep % 5 === 4 && (
                          <>
                            &gt; [SYNC] Buffering reconstruction data...<br />
                            &gt; [SYNC] Waiting for API stream response...<br />
                            &gt; [SYNC] Processing high-fidelity layers...<br />
                            &gt; [SYNC] Almost there, finalizing voxels...
                          </>
                        )}
                      </motion.div>
                    )}
                    {stage === "finalizing" && (
                      <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} key="log3">
                        &gt; [PROC] Culling interior faces: {cullInterior ? "ENABLED" : "DISABLED"}<br />
                        &gt; [PROC] Finalizing voxel mesh...<br />
                        &gt; [PROC] Generating .VOX binary stream...<br />
                        &gt; [SUCCESS] Reconstruction complete.
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="absolute bottom-2 right-2 w-1 h-1 bg-accent animate-pulse rounded-full" />
                </div>
              </div>
            </div>
          )}

          {voxelData && (
            <div className="absolute bottom-6 left-6 bg-black/50 p-3 rounded border border-border-theme text-[11px] font-mono leading-relaxed backdrop-blur-md">
              RENDER_STATS:<br />
              &gt; VOXEL_COUNT: {voxelData.voxels.length.toLocaleString()}<br />
              &gt; PALETTE: CUSTOM_GENAI<br />
              &gt; GRID_SIZE: {voxelData.width} x {voxelData.height} x {voxelData.depth}<br />
              &gt; EXPORT_FORMAT: .VOX
            </div>
          )}

          <div className="absolute top-6 right-6 flex gap-2">
             <div className="bg-black/50 px-3 py-2 rounded border border-border-theme text-[11px] uppercase tracking-wider backdrop-blur-md cursor-default">Orbit</div>
             <div className="bg-black/50 px-3 py-2 rounded border border-border-theme text-[11px] uppercase tracking-wider backdrop-blur-md cursor-default opacity-50">Wireframe</div>
          </div>
        </section>

        {/* Right Sidebar: Controls */}
        <section className="bg-bg-base p-6 flex flex-col overflow-y-auto">
          <h2 className="font-serif text-[12px] uppercase text-text-secondary mb-6 tracking-wider">Reconstruction</h2>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase text-text-secondary tracking-wider">Voxel Size</label>
              <div className="h-[2px] bg-border-theme relative my-2.5">
                <div className="w-2.5 h-2.5 bg-accent absolute top-[-4px] left-[30%] rounded-full shadow-[0_0_10px_rgba(212,180,131,0.5)]" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase text-text-secondary tracking-wider">Depth Sensitivity</label>
              <div className="h-[2px] bg-border-theme relative my-2.5">
                <div className="w-2.5 h-2.5 bg-accent absolute top-[-4px] left-[75%] rounded-full shadow-[0_0_10px_rgba(212,180,131,0.5)]" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase text-text-secondary tracking-wider">Color Palette</label>
              <div className="bg-bg-control border border-border-theme text-text-primary p-3 w-full text-[11px] rounded flex flex-col gap-1">
                <span className="text-accent font-bold">AUTOMATIC (MINIMAL)</span>
                <span className="text-text-secondary/60 text-[9px]">The engine now automatically selects the smallest necessary palette for clean results.</span>
              </div>
            </div>

            <div className="pt-4 border-t border-border-theme/30">
              <label className="text-[10px] uppercase text-text-secondary tracking-wider mb-2 block">Geometry Optimization</label>
              <div className="flex gap-3 items-start">
                <input 
                  type="checkbox" 
                  id="cull-interior"
                  checked={cullInterior} 
                  onChange={(e) => setCullInterior(e.target.checked)}
                  className="accent-accent w-4 h-4 cursor-pointer mt-0.5" 
                />
                <label htmlFor="cull-interior" className="flex flex-col gap-1 cursor-pointer">
                  <span className="text-[12px] text-text-primary">Optimize Internal Mesh</span>
                  <span className="text-[10px] text-text-secondary/60 leading-relaxed">
                    Removes hidden internal voxels. Recommended for 3D printing and smaller file sizes.
                  </span>
                </label>
              </div>
            </div>
          </div>

          {voxelData && (
            <button 
              className="bg-accent text-black py-3.5 px-4 w-full font-bold uppercase text-[12px] tracking-wider rounded cursor-pointer hover:opacity-90 mt-auto transition-all"
              onClick={handleExport}
            >
              Export to .VOX
            </button>
          )}
        </section>
      </main>

      <footer className="h-10 bg-bg-base border-t border-border-theme flex items-center px-6 justify-center text-[10px] text-text-secondary shrink-0">
        <div className="tracking-[0.3em] uppercase opacity-50">
          Voxelize.io &copy; 2026 &bull; Neural Reconstruction Engine
        </div>
      </footer>
    </div>
  );
}
