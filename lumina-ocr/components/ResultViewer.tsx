import React, { useState } from 'react';
import { Copy, Check, FileText, Sparkles } from './Icons';

interface ResultViewerProps {
  text: string;
  isProcessing: boolean;
}

const ResultViewer: React.FC<ResultViewerProps> = ({ text, isProcessing }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden transition-colors duration-300">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
            <div className="text-primary">
                <FileText size={18} />
            </div>
            <span className="font-semibold text-sm text-foreground">Extraction Result</span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium ml-2 border border-border">
                Plain Text
            </span>
        </div>
        <button
          onClick={handleCopy}
          disabled={!text || isProcessing}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 hover:bg-muted p-1.5 rounded-md"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="flex-1 overflow-auto relative p-6 bg-card">
        {isProcessing ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10 space-y-4">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles size={16} className="text-primary animate-pulse" />
              </div>
            </div>
            <p className="text-sm font-medium text-muted-foreground animate-pulse">Analyzing document structure...</p>
          </div>
        ) : !text ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50">
            <FileText size={48} className="mb-4 opacity-20" />
            <p className="text-sm">Ready to scan. Use the "New Scan" button.</p>
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none text-card-foreground font-mono text-sm leading-relaxed whitespace-pre-wrap">
            {text}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultViewer;