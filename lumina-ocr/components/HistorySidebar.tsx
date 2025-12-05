import React from 'react';
import { LayoutGrid, ScanText } from './Icons';

interface SidebarProps {
  currentView: 'dashboard' | 'detail';
  onNavigate: (view: 'dashboard') => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  return (
    <div className="w-20 md:w-64 bg-card border-r border-border h-full flex flex-col transition-all duration-300 z-20">
      {/* Empty Header / Logo Removed as requested */}
      <div className="h-16 flex items-center justify-center md:justify-start md:px-6 border-b border-border">
         <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center text-primary">
            <ScanText size={20} />
         </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-6 px-3 space-y-2">
        <button
          onClick={() => onNavigate('dashboard')}
          className={`w-full flex items-center justify-center md:justify-start gap-3 p-3 rounded-lg text-sm font-medium transition-colors
            ${currentView === 'dashboard' 
              ? 'bg-primary/10 text-primary' 
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
        >
          <LayoutGrid size={20} />
          <span className="hidden md:inline">Dashboard</span>
        </button>
      </div>

      {/* Footer / User Profile */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-center md:justify-start gap-3">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold text-xs">
            JD
          </div>
          <div className="hidden md:block overflow-hidden">
            <p className="text-sm font-medium truncate">John Doe</p>
            <p className="text-xs text-muted-foreground truncate">Pro Plan</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;