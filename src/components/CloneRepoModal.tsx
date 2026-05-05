
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Github, 
  Gitlab, 
  GitBranch, 
  X, 
  Search, 
  Lock, 
  Globe, 
  Check, 
  Download, 
  AlertCircle,
  Loader2,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { gitService, Repository, GitProvider, GitAuth } from '../services/gitIntegrationService';
import { cn } from '../lib/utils';

interface CloneRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCloneSuccess: (path: string) => void;
}

const PROVIDERS: { id: GitProvider; name: string; icon: any; color: string }[] = [
  { id: 'github', name: 'GitHub', icon: Github, color: '#24292e' },
  { id: 'gitlab', name: 'GitLab', icon: Gitlab, color: '#e24329' },
  { id: 'bitbucket', name: 'Bitbucket', icon: GitBranch, color: '#0052cc' },
  { id: 'azure', name: 'Azure DevOps', icon: Globe, color: '#0078d4' },
  { id: 'gitea', name: 'Gitea', icon: GitBranch, color: '#609926' },
  { id: 'codecommit', name: 'AWS CodeCommit', icon: Globe, color: '#FF9900' },
];

export const CloneRepoModal: React.FC<CloneRepoModalProps> = ({ isOpen, onClose, onCloneSuccess }) => {
  const [step, setStep] = useState<'provider' | 'auth' | 'repos' | 'cloning'>('provider');
  const [selectedProvider, setSelectedProvider] = useState<GitProvider | null>(null);
  const [auth, setAuth] = useState<Partial<GitAuth>>({});
  const [repos, setRepos] = useState<Repository[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetPath, setTargetPath] = useState('external-repos');

  useEffect(() => {
    if (!isOpen) {
      setStep('provider');
      setSelectedProvider(null);
      setAuth({});
      setRepos([]);
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  const handleProviderSelect = (provider: GitProvider) => {
    setSelectedProvider(provider);
    setAuth({ provider });
    setStep('auth');
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.token) {
      setError('Token is required');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const fetchedRepos = await gitService.listRepositories(auth as GitAuth);
      setRepos(fetchedRepos);
      setStep('repos');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloneRepo = async (repo: Repository) => {
    setIsLoading(true);
    setError(null);
    setStep('cloning');
    
    // Suggest a path based on repo name
    const path = `${targetPath}/${repo.name}`;
    
    try {
      const result = await gitService.cloneRepository(repo.url, path, auth.token, repo.provider);
      if (result.success) {
        onCloneSuccess(path);
        onClose();
      } else {
        setError(result.message || 'Cloning failed');
        setStep('repos');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during cloning');
      setStep('repos');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRepos = repos.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-[#1e1e1e] border border-white/10 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-vscode-blue/20 flex items-center justify-center text-vscode-blue">
                  <Download size={18} />
                </div>
                <div>
                  <h2 className="text-white font-medium text-lg">Clone Repository</h2>
                  <p className="text-[#858585] text-xs">Import from your favorite git provider</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-lg text-[#858585] hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                  <AlertCircle className="text-red-400 mt-0.5" size={18} />
                  <div className="text-sm text-red-100">{error}</div>
                </div>
              )}

              {step === 'provider' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleProviderSelect(p.id)}
                      className="flex flex-col items-center gap-4 p-6 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110" style={{ backgroundColor: p.color }}>
                        <p.icon size={24} />
                      </div>
                      <span className="text-sm font-medium text-[#cccccc] group-hover:text-white">{p.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {step === 'auth' && selectedProvider && (
                <div className="max-w-md mx-auto">
                  <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => setStep('provider')} className="text-[#858585] hover:text-white transition-colors">
                      <X size={16} className="rotate-0 transition-transform hover:rotate-90" />
                    </button>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded flex items-center justify-center text-white" style={{ backgroundColor: PROVIDERS.find(p => p.id === selectedProvider)?.color }}>
                        {React.createElement(PROVIDERS.find(p => p.id === selectedProvider)!.icon, { size: 14 })}
                      </div>
                      <span className="text-white font-medium">Connect to {PROVIDERS.find(p => p.id === selectedProvider)?.name}</span>
                    </div>
                  </div>

                  <form onSubmit={handleAuthSubmit} className="space-y-6">
                    <div className="space-y-2">
                    <label className="text-xs font-medium text-[#858585] uppercase tracking-wider">Personal Access Token</label>
                      <div className="relative">
                        <input 
                          type="password"
                          placeholder="Paste your token here..."
                          className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-vscode-blue transition-colors"
                          value={auth.token || ''}
                          onChange={(e) => setAuth({ ...auth, token: e.target.value })}
                        />
                        <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                      </div>
                      <p className="text-[11px] text-[#858585] mt-2 leading-relaxed">
                        Generate a PAT from your provider settings with <span className="text-white font-mono bg-white/5 px-1 rounded">repo</span> permissions.
                      </p>
                    </div>

                    {selectedProvider === 'bitbucket' && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-[#858585] uppercase tracking-wider">Username / Workspace</label>
                        <input 
                          type="text"
                          placeholder="e.g. atlassian"
                          className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-vscode-blue transition-colors"
                          value={auth.username || ''}
                          onChange={(e) => setAuth({ ...auth, username: e.target.value })}
                        />
                      </div>
                    )}

                    <button 
                      type="submit"
                      disabled={isLoading || !auth.token}
                      className="w-full bg-vscode-blue hover:bg-vscode-blue-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      {isLoading ? <Loader2 className="animate-spin" size={18} /> : <span>Fetch Repositories</span>}
                      {!isLoading && <ChevronRight size={18} />}
                    </button>
                  </form>
                </div>
              )}

              {step === 'repos' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 relative">
                      <input 
                        type="text"
                        placeholder="Search repositories..."
                        className="w-full bg-black/30 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-vscode-blue transition-colors"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858585]" size={16} />
                    </div>
                    <button 
                      onClick={() => setStep('auth')}
                      className="px-4 py-2.5 rounded-lg border border-white/10 text-[#858585] hover:text-white hover:bg-white/5 transition-all text-sm"
                    >
                      Change Auth
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                    {filteredRepos.length > 0 ? (
                      filteredRepos.map(repo => (
                        <div 
                          key={repo.id}
                          className="group p-4 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.04] hover:border-white/10 transition-all flex items-center justify-between"
                        >
                          <div className="flex items-center gap-4 overflow-hidden">
                            <img src={repo.owner.avatarUrl} alt="" className="w-10 h-10 rounded-lg" />
                            <div className="overflow-hidden">
                              <div className="flex items-center gap-2">
                                <span className="text-white font-medium truncate">{repo.name}</span>
                                {repo.private && <Lock size={12} className="text-amber-400" />}
                                {repo.isFork && <GitBranch size={12} className="text-[#858585]" />}
                                {repo.hasCi && <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="CI/CD Active" />}
                              </div>
                              <p className="text-[#858585] text-xs truncate">{repo.fullName}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleCloneRepo(repo)}
                            disabled={isLoading}
                            className="bg-white/5 hover:bg-vscode-blue hover:text-white px-4 py-2 rounded-lg text-[#cccccc] text-xs font-medium transition-all flex items-center gap-2"
                          >
                            <Download size={14} />
                            Clone
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center">
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 text-[#858585]">
                          <Search size={24} />
                        </div>
                        <p className="text-[#858585] text-sm">No repositories found matching your search.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 'cloning' && (
                <div className="py-12 text-center space-y-6">
                  <div className="relative inline-block">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      className="w-20 h-20 rounded-full border-4 border-vscode-blue/20 border-t-vscode-blue"
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-vscode-blue">
                      <Download size={32} />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-white font-medium text-lg">Cloning Repository</h3>
                    <p className="text-[#858585] text-sm mt-2">Initializing download into <span className="text-vscode-blue font-mono">{targetPath}/...</span></p>
                  </div>
                  <div className="max-w-xs mx-auto bg-black/40 rounded-full h-1.5 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '80%' }}
                      transition={{ duration: 5, ease: 'easeOut' }}
                      className="h-full bg-vscode-blue"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {(step === 'repos' || step === 'auth') && (
              <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#858585] text-[10px] uppercase tracking-widest font-bold">
                  <TerminalIcon size={12} />
                  <span>git clone active</span>
                </div>
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-2">
                     <span className="text-xs text-[#858585]">Target:</span>
                     <input 
                       className="bg-transparent border-none outline-none text-xs text-white font-mono"
                       value={targetPath}
                       onChange={(e) => setTargetPath(e.target.value)}
                     />
                   </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

function TerminalIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}
