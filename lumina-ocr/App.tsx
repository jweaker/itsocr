import React, { useState, useRef, useEffect } from 'react';
import { 
  Loader2, 
  Sparkles, 
  ScanText, 
  Sun, 
  Moon, 
  X, 
  UploadCloud, 
  ArrowLeft,
  Calendar,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  FileText,
  File,
  Plus
} from './components/Icons';
import { performOCR } from './services/geminiService';
import ResultViewer from './components/ResultViewer';
import { HistoryItem } from './types';

// --- UI Components ---

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost' | 'secondary', size?: 'default' | 'sm' | 'lg' | 'icon' }>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
    const variants = {
      default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
      outline: "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
    };
    const sizes = {
      default: "h-9 px-4 py-2",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-10 rounded-md px-8",
      icon: "h-9 w-9",
    };
    return (
      <button ref={ref} className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className || ''}`} {...props} />
    );
  }
);

const Badge: React.FC<{ children?: React.ReactNode, className?: string, variant?: 'default' | 'outline' | 'secondary' }> = ({ children, className, variant = 'default' }) => {
    const variants = {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "text-foreground border-border"
    };
    return (
        <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
};

const Card: React.FC<{ children?: React.ReactNode, className?: string, onClick?: () => void }> = ({ children, className, onClick }) => (
  <div onClick={onClick} className={`rounded-xl border border-border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all duration-200 ${className}`}>
    {children}
  </div>
);

const Dialog: React.FC<{ open: boolean; onClose: () => void; children?: React.ReactNode }> = ({ open, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-0 duration-200">
      <div className="relative w-full max-w-lg border bg-card p-6 shadow-lg sm:rounded-lg animate-in zoom-in-95 duration-200">
        {children}
        <button onClick={onClose} className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </div>
  );
};

// --- Main App ---

const App = () => {
  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Navigation State
  const [currentView, setCurrentView] = useState<'dashboard' | 'detail'>('dashboard');

  // Data State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  
  // OCR / New Scan State
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const text = await performOCR(file);
      
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        fileName: file.name,
        extractedText: text,
        thumbnailUrl: previewUrl || '',
        date: new Date().toLocaleDateString(),
        status: 'completed'
      };

      setHistory(prev => [newItem, ...prev]);
      
      // Auto-navigate to result
      setSelectedHistoryId(newItem.id);
      setExtractedText(text);
      setCurrentView('detail');
      
      setIsDialogOpen(false); 

    } catch (error) {
      console.error(error);
      alert("Scan Failed: Could not process the image.");
    } finally {
      setIsProcessing(false);
    }
  };

  const openNewScan = () => {
    setFile(null);
    setPreviewUrl(null);
    setExtractedText("");
    setIsDialogOpen(true);
  };

  const handleCardClick = (item: HistoryItem) => {
    setSelectedHistoryId(item.id);
    setExtractedText(item.extractedText);
    setPreviewUrl(item.thumbnailUrl);
    setCurrentView('detail');
  };

  const navigateHome = () => {
    setCurrentView('dashboard');
    setSelectedHistoryId(null);
  };

  // -- Views --

  const DashboardView = () => {
    const totalScans = history.length;
    const todayScans = history.filter(h => h.date === new Date().toLocaleDateString()).length;

    return (
      <div className="p-6 md:p-10 w-full space-y-8 overflow-y-auto h-full animate-in fade-in slide-in-from-bottom-2 duration-500">
        
        {/* Header with New Scan Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
            <p className="text-muted-foreground mt-1">Manage your documents and extractions.</p>
          </div>
          <Button onClick={openNewScan} size="lg" className="shadow-lg">
            <Plus className="mr-2 h-4 w-4" />
            New Scan
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="p-6 flex items-center justify-between space-x-4">
             <div>
                <p className="text-sm font-medium text-muted-foreground">Total Scans</p>
                <h3 className="text-2xl font-bold">{totalScans}</h3>
             </div>
             <div className="p-3 bg-primary/10 text-primary rounded-full">
                <ScanText size={24} />
             </div>
          </Card>
          
          <Card className="p-6 flex items-center justify-between space-x-4">
             <div>
                <p className="text-sm font-medium text-muted-foreground">Processed Today</p>
                <h3 className="text-2xl font-bold">{todayScans}</h3>
             </div>
             <div className="p-3 bg-secondary text-secondary-foreground rounded-full">
                <Clock size={24} />
             </div>
          </Card>

           <Card className="p-6 flex items-center justify-between space-x-4">
             <div>
                <p className="text-sm font-medium text-muted-foreground">System Status</p>
                <div className="flex items-center gap-2 mt-1">
                   <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                   <span className="text-sm font-medium">Operational</span>
                </div>
             </div>
             <div className="p-3 bg-muted text-muted-foreground rounded-full">
                <CheckCircle2 size={24} />
             </div>
          </Card>
        </div>

        {/* Recent Scans Grid */}
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold tracking-tight">Recent Scans</h3>
            </div>
            
            {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-muted rounded-xl bg-muted/5">
                    <div className="p-4 bg-background rounded-full mb-4 shadow-sm">
                        <UploadCloud className="text-muted-foreground h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-medium">No documents yet</h3>
                    <p className="text-muted-foreground text-sm text-center max-w-sm mt-1 mb-6">
                        Upload an image to extract text, data, or markdown instantly.
                    </p>
                    <Button onClick={openNewScan}>Create your first scan</Button>
                </div>
            ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {history.map((item) => (
                        <Card 
                            key={item.id} 
                            onClick={() => handleCardClick(item)}
                            className="group cursor-pointer overflow-hidden flex flex-col hover:border-primary/50 transition-all duration-300"
                        >
                            {/* Card Header (Preview) */}
                            <div className="relative aspect-[16/9] bg-muted/30 overflow-hidden border-b border-border/50">
                                {item.thumbnailUrl ? (
                                    <img 
                                        src={item.thumbnailUrl} 
                                        alt={item.fileName} 
                                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-transform duration-500" 
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                        <File size={32} />
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Badge className="bg-background/90 text-foreground shadow-sm backdrop-blur">
                                        View Details
                                    </Badge>
                                </div>
                            </div>

                            {/* Card Content */}
                            <div className="p-4 flex flex-col gap-3 flex-1">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1 overflow-hidden">
                                        <h4 className="font-semibold text-sm truncate leading-none" title={item.fileName}>
                                            {item.fileName}
                                        </h4>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Calendar size={12} />
                                            <span>{item.date}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="h-12 text-xs text-muted-foreground overflow-hidden leading-relaxed line-clamp-2 font-mono bg-muted/20 p-1.5 rounded border border-border/50">
                                    {item.extractedText.slice(0, 150) || "No text content preview."}
                                </div>

                                <div className="mt-auto flex items-center justify-between pt-2">
                                    <Badge variant="secondary" className="text-[10px] h-5 px-2 font-normal">
                                        Completed
                                    </Badge>
                                    <MoreHorizontal size={16} className="text-muted-foreground hover:text-foreground" />
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
      </div>
    );
  };

  const DetailView = () => {
    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Detail Header */}
            <div className="h-16 border-b border-border bg-card/50 flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={navigateHome} className="gap-2 -ml-2">
                        <ArrowLeft size={16} />
                        Back
                    </Button>
                    <div className="h-4 w-[1px] bg-border mx-1" />
                    <h2 className="text-sm font-semibold truncate max-w-[200px] md:max-w-md">
                        {history.find(h => h.id === selectedHistoryId)?.fileName || "Document Results"}
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={openNewScan}>New Scan</Button>
                </div>
            </div>

            {/* Content Split */}
            <div className="flex-1 overflow-hidden p-4 md:p-6">
                 <div className="h-full flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto">
                    {/* Source Image */}
                    {previewUrl && (
                        <div className="w-full lg:w-1/3 h-64 lg:h-full flex flex-col gap-3 animate-in slide-in-from-left-4 duration-500">
                           <div className="flex-1 rounded-xl border border-border bg-card overflow-hidden shadow-sm relative group">
                                <img 
                                    src={previewUrl} 
                                    alt="Source" 
                                    className="w-full h-full object-contain p-4 bg-muted/20 transition-transform duration-500" 
                                />
                           </div>
                           <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
                                <h3 className="text-sm font-semibold mb-2">Metadata</h3>
                                <div className="space-y-2 text-xs text-muted-foreground">
                                    <div className="flex justify-between">
                                        <span>Status</span>
                                        <span className="text-green-500 font-medium">Processed</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Date</span>
                                        <span>{history.find(h => h.id === selectedHistoryId)?.date}</span>
                                    </div>
                                </div>
                           </div>
                        </div>
                    )}
                    
                    {/* Editor */}
                    <div className="flex-1 h-full min-h-0">
                        <ResultViewer text={extractedText} isProcessing={isProcessing} />
                    </div>
                 </div>
            </div>
        </div>
    );
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans transition-colors duration-300">
      
      {/* Main Content Area - Full Width */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-muted/10">
        
        {/* Top Navbar */}
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 z-10">
             <div className="flex items-center gap-2">
                 <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center text-primary">
                    <ScanText size={20} />
                 </div>
                 <span className="font-bold tracking-tight">OCR Dashboard</span>
             </div>
             
             {/* Right Side: Theme Toggle & User Profile */}
             <div className="flex items-center gap-4">
                 <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="rounded-full">
                   {theme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
                 </Button>

                 <div className="h-6 w-[1px] bg-border mx-1" />

                 <div className="flex items-center gap-3">
                    <div className="text-right hidden md:block">
                        <p className="text-sm font-medium leading-none">John Doe</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold text-xs ring-2 ring-background">
                        JD
                    </div>
                 </div>
             </div>
        </header>

        {/* Dynamic View Content */}
        <div className="flex-1 overflow-hidden relative">
             {currentView === 'dashboard' ? <DashboardView /> : <DetailView />}
        </div>

        {/* --- Dialog (Modal) for New Scan --- */}
        <Dialog open={isDialogOpen} onClose={() => !isProcessing && setIsDialogOpen(false)}>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col space-y-1.5 text-center sm:text-left">
              <h3 className="text-lg font-semibold leading-none tracking-tight">New OCR Scan</h3>
              <p className="text-sm text-muted-foreground">Upload an image to extract text using Gemini AI.</p>
            </div>

            {/* File Upload Area */}
            <div 
               onClick={() => !isProcessing && fileInputRef.current?.click()}
               className={`
                  border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all h-64
                  ${file 
                    ? 'border-primary/50 bg-primary/5' 
                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                  }
               `}
            >
               <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleFileSelect}
               />
               
               {file && previewUrl ? (
                 <div className="relative w-full h-full">
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                    <div className="absolute top-2 right-2 bg-background/90 text-foreground px-2 py-1 rounded text-xs font-medium border shadow-sm flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-green-500"/>
                      {file.name}
                    </div>
                 </div>
               ) : (
                 <>
                    <div className="p-4 bg-muted rounded-full">
                       <UploadCloud className="text-muted-foreground" size={32} />
                    </div>
                    <div className="text-center">
                       <p className="text-sm font-medium">Click to select image</p>
                       <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP supported</p>
                    </div>
                 </>
               )}
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-3">
               <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isProcessing}>
                 Cancel
               </Button>
               <Button onClick={handleAnalyze} disabled={!file || isProcessing} className="w-32">
                 {isProcessing ? (
                   <>
                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                     Scanning
                   </>
                 ) : (
                   <>
                     <Sparkles className="mr-2 h-4 w-4" />
                     Start OCR
                   </>
                 )}
               </Button>
            </div>
          </div>
        </Dialog>
      </main>
    </div>
  );
};

export default App;