import React, { useState, useEffect } from 'react';
import { 
  Library, 
  Package, 
  Plus, 
  Cpu, 
  ExternalLink, 
  RefreshCcw, 
  Trash2, 
  Search,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Dependency {
  name: string;
  version: string;
  isDev: boolean;
}

export const DependencyExplorer: React.FC = () => {
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPackage, setNewPackage] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    fetchDependencies();
  }, []);

  const fetchDependencies = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/dependencies');
      if (!response.ok) throw new Error('Failed to fetch dependencies');
      const data = await response.json();
      
      const deps: Dependency[] = [];
      if (data.dependencies) {
        Object.entries(data.dependencies).forEach(([name, version]) => {
          deps.push({ name, version: version as string, isDev: false });
        });
      }
      if (data.devDependencies) {
        Object.entries(data.devDependencies).forEach(([name, version]) => {
          deps.push({ name, version: version as string, isDev: true });
        });
      }
      setDependencies(deps);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPackage) return;

    setIsInstalling(true);
    try {
      const response = await fetch('/api/dependencies/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPackage })
      });
      if (!response.ok) throw new Error('Installation failed');
      await fetchDependencies();
      setNewPackage('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleUninstall = async (name: string) => {
    try {
      const response = await fetch('/api/dependencies/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (!response.ok) throw new Error('Uninstall failed');
      await fetchDependencies();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      <div className="p-3 border-b border-white/5 bg-white/[0.02]">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#858585] mb-3">Library Manager</h3>
        
        <form onSubmit={handleInstall} className="flex items-center gap-2 mb-2">
          <div className="relative flex-1">
            <input 
              type="text"
              placeholder="Package name..."
              className="w-full bg-black/30 border border-white/5 rounded px-3 py-1.5 text-[11px] text-[#cccccc] focus:outline-none focus:border-vscode-blue transition-colors"
              value={newPackage}
              onChange={(e) => setNewPackage(e.target.value)}
              disabled={isInstalling}
            />
          </div>
          <button 
            type="submit"
            disabled={isInstalling || !newPackage}
            className="p-1.5 bg-vscode-blue text-white rounded hover:bg-vscode-blue/80 disabled:opacity-50 transition-all shadow-md"
          >
            {isInstalling ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {isLoading ? (
          <div className="py-8 text-center text-[#858585]">
            <Loader2 size={20} className="animate-spin mx-auto mb-2" />
            <span className="text-[10px] uppercase font-bold tracking-widest">Loading packages...</span>
          </div>
        ) : dependencies.length > 0 ? (
          <div className="space-y-1">
            <div className="text-[9px] uppercase font-extrabold tracking-tighter text-[#444444] px-2 py-1 flex items-center justify-between">
              <span>Managed Dependencies</span>
              <button onClick={fetchDependencies} className="hover:text-vscode-blue transition-colors">
                <RefreshCcw size={8} />
              </button>
            </div>
            {dependencies.map((dep, idx) => (
              <div 
                key={`${dep.name}-${dep.isDev ? 'dev' : 'prod'}-${idx}`}
                className="group p-2 flex items-center justify-between rounded hover:bg-white/[0.02] border border-transparent hover:border-white/5 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded bg-vscode-blue/10 flex items-center justify-center text-vscode-blue">
                    <Package size={14} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-white">{dep.name}</span>
                      {dep.isDev && <span className="text-[8px] bg-white/5 text-gray-500 px-1 rounded border border-white/5 uppercase">dev</span>}
                    </div>
                    <span className="text-[10px] text-[#858585] font-mono">{dep.version.replace('^', '')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <a 
                    href={`https://www.npmjs.com/package/${dep.name}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="p-1 text-[#858585] hover:text-white transition-colors"
                  >
                    <ExternalLink size={10} />
                  </a>
                  <button 
                    onClick={() => handleUninstall(dep.name)}
                    className="p-1 text-[#858585] hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-[#858585]">
            <Library size={32} className="mx-auto mb-3 opacity-20" />
            <p className="text-[11px]">No dependencies managed yet.</p>
          </div>
        )}
      </div>

      <div className="p-3 bg-white/[0.02] border-t border-white/5 mt-auto">
         <div className="flex items-center justify-between text-[10px] text-gray-600 font-bold uppercase tracking-widest">
            <span className="flex items-center gap-1">
               <Cpu size={10} />
               Node Engine 20.x
            </span>
            <span className="text-vscode-blue/40 tracking-tighter">NPM Registry v8.2.3</span>
         </div>
      </div>
    </div>
  );
};
