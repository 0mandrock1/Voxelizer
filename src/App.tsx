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
  const [voxelData, setVoxelData] = useState<VoxelData | null>(null);
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
    setStage("analyzing");
    setError(null);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev < 30) return prev + 2;
        if (prev < 70 && stage === "voxelizing") return prev + 1;
        if (prev < 95 && stage === "finalizing") return prev + 0.5;
        return prev;
      });
    }, 100);

    try {
      const base64Data = image.split(",")[1];
      
      // Stage 1: Analyzing
      setTimeout(() => setStage("voxelizing"), 1500);
      
      const data = await generateVoxelFromImage(base64Data, mimeType);
      
      // Stage 2: Finalizing
      setStage("finalizing");
      setProgress(90);
      
      setVoxelData(data);
      setProgress(100);
    } catch (err) {
      console.error(err);
      setError("Failed to process image. Please try again.");
    } finally {
      clearInterval(progressInterval);
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

  return (
    <div className="min-h-screen bg-bg-base text-text-primary font-sans flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-border-theme flex items-center justify-between px-6 shrink-0">
        <div className="font-serif italic text-xl tracking-[2px] text-accent uppercase">
          Voxelize.io
        </div>
        <div className="flex gap-5">
          <button className="text-text-secondary text-sm uppercase tracking-wider hover:text-text-primary transition-colors">Settings</button>
          <button className="text-text-secondary text-sm uppercase tracking-wider hover:text-text-primary transition-colors">Documentation</button>
          <button className="text-text-secondary text-sm uppercase tracking-wider hover:text-text-primary transition-colors">Account</button>
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
            <h2 className="font-serif text-[12px] uppercase text-text-secondary mb-4 tracking-wider">Recent Sessions</h2>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 items-center opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-not-allowed">
                  <div className="w-10 h-10 bg-bg-control rounded-sm shrink-0" />
                  <div className="overflow-hidden">
                    <p className="text-[12px] truncate">Session_Asset_0{i}.png</p>
                    <span className="text-[10px] text-text-secondary">128x128 &bull; 2.4MB</span>
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
              <label className="text-[10px] uppercase text-text-secondary tracking-wider">Color Quantization</label>
              <select className="bg-bg-control border border-border-theme text-text-primary p-2 w-full text-[12px] rounded outline-none focus:border-accent transition-colors">
                <option>256 Colors (Optimized)</option>
                <option>128 Colors (Stylized)</option>
                <option>64 Colors (Lo-Fi)</option>
              </select>
            </div>

            <div className="pt-4">
              <label className="text-[10px] uppercase text-text-secondary tracking-wider mb-3 block">Optimization</label>
              <div className="flex gap-3 items-center">
                <input type="checkbox" defaultChecked className="accent-accent w-4 h-4" />
                <span className="text-[12px] text-text-secondary">Cull Interior Faces</span>
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

      <footer className="h-10 bg-bg-base border-t border-border-theme flex items-center px-6 justify-between text-[10px] text-text-secondary shrink-0">
        <div className="flex items-center">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></span>
          Engine Ready: Neural_Voxel_v2.4
        </div>
        <div>Current Project: Unnamed_Asset_01 &nbsp; | &nbsp; {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </footer>
    </div>
  );
}
