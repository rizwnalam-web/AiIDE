import React, { useState, useEffect } from 'react';
import { 
  Puzzle, 
  Search, 
  Settings, 
  Download, 
  Trash2, 
  Check, 
  X, 
  Star, 
  Clock, 
  Globe,
  Loader2,
  AlertCircle,
  MoreVertical
} from 'lucide-react';
import { extensionService } from '../services/extensionService';
import { Extension } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const ExtensionMarketplace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'marketplace' | 'installed'>('marketplace');
  const [searchQuery, setSearchQuery] = useState('');
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    loadExtensions();
  }, [activeTab, searchQuery, refreshTrigger]);

  const loadExtensions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let data: Extension[] = [];
      if (activeTab === 'marketplace') {
        data = await extensionService.getMarketplaceExtensions(searchQuery);
      } else {
        data = await extensionService.getInstalledExtensions();
        if (searchQuery) {
          data = data.filter(e => 
            e.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
            e.description.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
      }
      setExtensions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load extensions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstall = async (ext: Extension) => {
    try {
      await extensionService.installExtension(ext);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUninstall = async (id: string) => {
    try {
      await extensionService.uninstallExtension(id);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await extensionService.toggleExtension(id, enabled);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      <div className="p-3 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#858585]">Extensions</h3>
          <button className="text-[#858585] hover:text-white transition-colors">
            <MoreVertical size={14} />
          </button>
        </div>
        
        <div className="relative mb-3">
          <input 
            type="text"
            placeholder="Search Extensions in Marketplace"
            className="w-full bg-black/30 border border-white/5 rounded px-8 py-1.5 text-[11px] text-[#cccccc] focus:outline-none focus:border-vscode-blue transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#858585]" size={12} />
        </div>

        <div className="flex gap-4">
          <button 
            onClick={() => setActiveTab('marketplace')}
            className={cn(
              "text-[10px] font-bold uppercase tracking-tight transition-colors pb-1 border-b-2",
              activeTab === 'marketplace' ? "text-white border-vscode-blue" : "text-[#858585] border-transparent hover:text-[#cccccc]"
            )}
          >
            Marketplace
          </button>
          <button 
            onClick={() => setActiveTab('installed')}
            className={cn(
              "text-[10px] font-bold uppercase tracking-tight transition-colors pb-1 border-b-2",
              activeTab === 'installed' ? "text-white border-vscode-blue" : "text-[#858585] border-transparent hover:text-[#cccccc]"
            )}
          >
            Installed
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {isLoading && extensions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#858585]">
            <Loader2 className="animate-spin mb-2" size={20} />
            <span className="text-[10px] uppercase font-bold tracking-widest">Searching...</span>
          </div>
        ) : extensions.length > 0 ? (
          <div className="space-y-1">
            {extensions.map((ext, idx) => (
              <div 
                key={`${ext.id}-${idx}`}
                className="group p-2 rounded hover:bg-white/[0.03] transition-all border border-transparent hover:border-white/5 flex gap-3"
              >
                <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center shrink-0 border border-white/10 group-hover:border-white/20 transition-all">
                  {ext.icon ? (
                    <img src={ext.icon} alt="" className="w-full h-full rounded" />
                  ) : (
                    <Puzzle size={20} className="text-vscode-blue" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-white truncate">{ext.displayName}</span>
                    {activeTab === 'marketplace' && !ext.installed && (
                      <button 
                        onClick={() => handleInstall(ext)}
                        className="bg-vscode-blue hover:bg-vscode-blue/80 text-white p-1 rounded transition-all opacity-0 group-hover:opacity-100"
                        title="Install"
                      >
                        <Download size={10} />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-[#858585] line-clamp-1 mb-1">{ext.description}</p>
                  <div className="flex items-center gap-2 text-[9px] text-gray-500">
                    <span className="text-vscode-blue/80 font-bold">{ext.publisher}</span>
                    <span>v{ext.version}</span>
                    {ext.downloads && (
                      <span className="flex items-center gap-1">
                        <Download size={8} />
                        {(ext.downloads / 1000).toFixed(1)}k
                      </span>
                    )}
                    {ext.rating && (
                      <span className="flex items-center gap-1 text-amber-500/80">
                        <Star size={8} fill="currentColor" />
                        {ext.rating}
                      </span>
                    )}
                  </div>

                  {ext.installed && (
                    <div className="flex items-center gap-2 mt-2">
                      <button 
                        onClick={() => handleToggle(ext.id, !ext.enabled)}
                        className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-bold transition-all border",
                          ext.enabled 
                            ? "bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20" 
                            : "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                        )}
                      >
                        {ext.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                      <button 
                        onClick={() => handleUninstall(ext.id)}
                        className="p-1 text-[#858585] hover:text-red-400 transition-colors"
                        title="Uninstall"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-[#858585] text-center px-4">
            <Puzzle className="mb-3 opacity-20" size={32} />
            <p className="text-[11px] font-medium leading-relaxed">
              {searchQuery ? `No extensions found for "${searchQuery}"` : "Discover features to supercharge your workflow."}
            </p>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-white/5 bg-white/[0.01]">
         <div className="flex items-center gap-2 text-[10px] text-[#858585] font-bold uppercase tracking-wider">
           <Download size={10} />
           <span>Runtime Version 2.2.0</span>
         </div>
      </div>
    </div>
  );
};
