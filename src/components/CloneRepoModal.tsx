
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
  ExternalLink,
  FolderOpen,
  Link as LinkIcon,
  FolderSearch,
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
  const [step, setStep] = useState<'provider' | 'auth' | 'repos' | 'cloning' | 'url'>('provider');
  const [selectedProvider, setSelectedProvider] = useState<GitProvider | null>(null);
  const [auth, setAuth] = useState<Partial<GitAuth>>({});
  const [repos, setRepos] = useState<Repository[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetPath, setTargetPath] = useState('');
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloneToken, setCloneToken] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [savedCredentials, setSavedCredentials] = useState<Record<string, Partial<GitAuth>>>({});

  useEffect(() => {
    if (isOpen) {
      gitService.getSavedCredentials().then(setSavedCredentials).catch(console.error);
    } else {
      setStep('provider');
      setSelectedProvider(null);
      setAuth({});
      setRepos([]);
      setError(null);
      setIsLoading(false);
      setCloneUrl('');
      setCloneToken('');
    }
  }, [isOpen]);

  /** Open a native folder-picker to choose the clone destination parent. */
  const browseTargetDir = async (repoName?: string) => {
    let folder: string | null = null;
    if ((window as any).electronAPI?.isElectron) {
      folder = await (window as any).electronAPI.openFolder();
    } else {
      folder = window.prompt('Enter parent directory path for clone:') ?? null;
    }
    if (folder) {
      setTargetPath(repoName ? `${folder}/${repoName}` : folder);
    }
  };

  /** Open a native folder picker and immediately open the chosen folder as a project. */
  const handleOpenLocalFolder = async () => {
    let folder: string | null = null;
    if ((window as any).electronAPI?.isElectron) {
      folder = await (window as any).electronAPI.openFolder();
    } else {
      folder = window.prompt('Enter the full path to the project folder:') ?? null;
    }
    if (!folder) return;
    onCloneSuccess(folder);
    onClose();
  };

  const handleProviderSelect = (provider: GitProvider) => {
    setSelectedProvider(provider);
    const saved = savedCredentials[provider];
    if (saved) {
      setAuth({ ...saved, provider });
    } else {
      setAuth({ provider });
    }
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
      
      if (rememberMe) {
        await gitService.saveCredentials(auth as GitAuth);
      }
      
      setStep('repos');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  /** Extract a reasonable repo name from a git URL. */
  const repoNameFromUrl = (url: string): string => {
    try {
      const parts = url.replace(/\.git$/, '').split('/');
      return parts[parts.length - 1] || 'repo';
    } catch {
      return 'repo';
    }
  };

  /** Clone from a manually-entered URL. */
  const handleCloneFromUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneUrl.trim()) {
      setError('Repository URL is required');
      return;
    }
    const effectiveTarget = targetPath.trim() || await (async () => {
      await browseTargetDir(repoNameFromUrl(cloneUrl));
      return '';
    })();
    if (!effectiveTarget && !targetPath.trim()) return;

    const dest = targetPath.trim();
    if (!dest) {
      setError('Please choose a destination folder first.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStep('cloning');
    try {
      const result = await gitService.cloneRepository(cloneUrl.trim(), dest, cloneToken || undefined);
      if (result.success) {
        onCloneSuccess(dest);
        onClose();
      } else {
        setError(result.message || 'Cloning failed');
        setStep('url');
      }
    } catch (err: any) {
      setError(err.message || 'Cloning failed');
      setStep('url');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloneRepo = async (repo: Repository) => {
    if (!targetPath.trim()) {
      setError('Choose a destination folder first (click "Browse…" below).');
      return;
    }
    setIsLoading(true);
    setError(null);
    setStep('cloning');
    
    const dest = `${targetPath}/${repo.name}`;
    
    try {
      const result = await gitService.cloneRepository(repo.url, dest, auth.token, repo.provider);
      if (result.success) {
        onCloneSuccess(dest);
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
            className="bg-[#1e1e1e] border border-white/10 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-vscode-blue/20 flex items-center justify-center text-vscode-blue">
                  <Download size={18} />
                </div>
                <div>
                  <h2 className="text-white font-medium text-lg">Open Project</h2>
                  <p className="text-[#858585] text-xs">Browse from your computer or clone from a repository</p>
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
                <div className="space-y-6">
                  {/* ── Local folder / URL ─────────────────────────────── */}
                  <div>
                    <p className="text-[10px] text-[#858585] uppercase font-bold tracking-widest mb-3">Local</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={handleOpenLocalFolder}
                        className="flex items-center gap-4 p-5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-vscode-blue/10 hover:border-vscode-blue/30 transition-all group text-left"
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-vscode-blue/20 text-vscode-blue transition-transform group-hover:scale-110">
                          <FolderOpen size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">Open Folder</p>
                          <p className="text-[11px] text-[#858585] mt-0.5">Browse your computer</p>
                        </div>
                      </button>
                      <button
                        onClick={() => { setError(null); setStep('url'); }}
                        className="flex items-center gap-4 p-5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-agent-teal/10 hover:border-agent-teal/30 transition-all group text-left"
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-agent-teal/20 text-agent-teal transition-transform group-hover:scale-110">
                          <LinkIcon size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">Clone from URL</p>
                          <p className="text-[11px] text-[#858585] mt-0.5">Paste any git URL</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* ── Authenticated providers ─────────────────────────── */}
                  <div>
                    <p className="text-[10px] text-[#858585] uppercase font-bold tracking-widest mb-3">Clone from provider</p>
                    <div className="grid grid-cols-3 gap-3">
                      {PROVIDERS.map((p, idx) => (
                        <button
                          key={`${p.id}-${idx}`}
                          onClick={() => handleProviderSelect(p.id)}
                          className="flex flex-col items-center gap-3 p-5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all group"
                        >
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110" style={{ backgroundColor: p.color }}>
                            <p.icon size={20} />
                          </div>
                          <span className="text-xs font-medium text-[#cccccc] group-hover:text-white">{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Clone from URL ────────────────────────────────────── */}
              {step === 'url' && (
                <div className="max-w-lg mx-auto">
                  <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => { setStep('provider'); setError(null); }} className="text-[#858585] hover:text-white transition-colors p-1">
                      <X size={16} />
                    </button>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded flex items-center justify-center bg-agent-teal/20 text-agent-teal">
                        <LinkIcon size={14} />
                      </div>
                      <span className="text-white font-medium">Clone from URL</span>
                    </div>
                  </div>

                  <form onSubmit={handleCloneFromUrl} className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-[#858585] uppercase tracking-wider">Repository URL</label>
                      <input
                        type="text"
                        autoFocus
                        placeholder="https://github.com/owner/repo.git"
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-vscode-blue transition-colors font-mono"
                        value={cloneUrl}
                        onChange={(e) => {
                          setCloneUrl(e.target.value);
                          if (targetPath === '' || targetPath.endsWith('/' + repoNameFromUrl(cloneUrl))) {
                            // auto-suggest repo name only if user hasn't customised the path
                          }
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-[#858585] uppercase tracking-wider">Access Token <span className="normal-case font-normal text-[#555]">(optional, for private repos)</span></label>
                      <div className="relative">
                        <input
                          type="password"
                          placeholder="ghp_..."
                          className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-vscode-blue transition-colors pr-10"
                          value={cloneToken}
                          onChange={(e) => setCloneToken(e.target.value)}
                        />
                        <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-[#858585] uppercase tracking-wider">Destination Folder</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Pick a folder →"
                          className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-vscode-blue transition-colors font-mono"
                          value={targetPath}
                          onChange={(e) => setTargetPath(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => browseTargetDir(cloneUrl ? repoNameFromUrl(cloneUrl) : undefined)}
                          className="px-4 py-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-[#cccccc] hover:text-white transition-all flex items-center gap-2 text-sm whitespace-nowrap"
                        >
                          <FolderSearch size={16} />
                          Browse…
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || !cloneUrl.trim() || !targetPath.trim()}
                      className="w-full bg-vscode-blue hover:bg-vscode-blue/80 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      {isLoading ? <Loader2 className="animate-spin" size={18} /> : <><Download size={18} /><span>Clone Repository</span></>}
                    </button>
                  </form>
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

                    <div className="flex items-center gap-3 py-2 cursor-pointer group" onClick={() => setRememberMe(!rememberMe)}>
                      <div className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center transition-all",
                        rememberMe ? "bg-vscode-blue border-vscode-blue text-white" : "border-white/20 group-hover:border-white/40"
                      )}>
                        {rememberMe && <Check size={10} strokeWidth={3} />}
                      </div>
                      <span className="text-xs text-[#858585] group-hover:text-[#cccccc] transition-colors">Securely save credentials on server</span>
                    </div>

                    <button 
                      type="submit"
                      disabled={isLoading || !auth.token}
                      className="w-full bg-vscode-blue hover:bg-vscode-blue/80 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2"
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

                  <div className="space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar pr-2">
                    {filteredRepos.length > 0 ? (
                      filteredRepos.map((repo, idx) => (
                        <div 
                          key={`${repo.id}-${idx}`}
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

            {/* Footer — clone destination picker (shown in repos & url steps) */}
            {(step === 'repos') && (
              <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-[#858585] text-[10px] uppercase tracking-widest font-bold shrink-0">
                  <TerminalIcon size={12} />
                  <span>Clone destination</span>
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input 
                    className="flex-1 bg-transparent border border-white/10 rounded px-2 py-1 outline-none text-xs text-white font-mono min-w-0 focus:border-vscode-blue transition-colors"
                    placeholder="Pick a folder…"
                    value={targetPath}
                    onChange={(e) => setTargetPath(e.target.value)}
                  />
                  <button
                    onClick={() => browseTargetDir()}
                    className="px-3 py-1.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-[#cccccc] hover:text-white transition-all flex items-center gap-1.5 text-xs whitespace-nowrap"
                  >
                    <FolderSearch size={14} />
                    Browse…
                  </button>
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
