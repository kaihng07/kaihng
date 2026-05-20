import { CreditCard, Server, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { SystemConfig } from '../types';

interface SidebarProps {
  config: SystemConfig | null;
  loadingConfig: boolean;
  onRefreshConfig: () => void;
  activeView: string;
  setActiveView: (view: string) => void;
}

export default function Sidebar({ config, loadingConfig, onRefreshConfig, activeView, setActiveView }: SidebarProps) {
  // Determine database status color of the dot
  // Green dot for MongoDB connected, Yellow for Memory mode, Red for connection failed/error
  let statusColor = 'bg-red-500 shadow-red-500/50';
  let statusText = 'Disconnected';
  let StatusIcon = AlertCircle;

  if (config) {
    if (config.connected && config.mode === 'database') {
      statusColor = 'bg-emerald-500 shadow-emerald-500/50';
      statusText = 'Database Connected';
      StatusIcon = CheckCircle2;
    } else if (config.mode === 'memory') {
      statusColor = 'bg-amber-400 shadow-amber-400/50';
      statusText = 'Memory Fallback (Demo)';
      StatusIcon = AlertTriangle;
    }
  }

  return (
    <aside className="w-64 bg-slate-950/40 backdrop-blur-xl text-slate-200 flex flex-col h-screen shrink-0 border-r border-white/5 select-none relative z-10">
      {/* Brand Section */}
      <div className="h-16 flex items-center px-6 border-b border-white/5 gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-550 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
          <CreditCard className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h1 className="font-extrabold tracking-wider text-sm bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">CARDNET</h1>
          <p className="text-[10px] text-slate-400 uppercase font-mono tracking-widest mt-[-2px]">Enterprise vCard</p>
        </div>
      </div>

      {/* Main Navigation Section */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest px-3 mb-2">Management</p>
        <button
          onClick={() => setActiveView('contacts')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 outline-none ${
            activeView === 'contacts'
              ? 'bg-white/10 border border-white/10 text-white shadow-[0_4px_12px_rgba(255,255,255,0.03)]'
              : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
          }`}
          id="sidebar-nav-contacts"
        >
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>Contacts List</span>
        </button>
      </nav>

      {/* Database Connection Status Section */}
      <div className="p-4 border-t border-white/5 bg-slate-950/20">
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 backdrop-blur-md">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Storage Node</span>
            <button
              onClick={onRefreshConfig}
              disabled={loadingConfig}
              className={`p-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition text-slate-400 hover:text-slate-200 outline-none ${
                loadingConfig ? 'animate-spin' : ''
              }`}
              title="Refresh connection status"
              id="sidebar-refresh-status"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-1">
              <span className={`flex h-2 w-2 rounded-full relative ${statusColor} animate-pulse`}>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-inherit opacity-75"></span>
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-slate-200 truncate">{statusText}</h4>
              {config?.uriSource && (
                <p className="text-[10px] text-indigo-400 font-semibold mt-0.5">
                  Detected: <code className="bg-indigo-950/40 px-1 py-0.5 rounded text-[9px]">{config.uriSource}</code>
                </p>
              )}
              <p className="text-[9px] text-slate-500 font-mono mt-0.5 truncate">
                {config?.connected ? `Pool: ${config.dbName}` : 'In-Memory Store'}
              </p>
            </div>
          </div>

          {config?.error && (
            <div className="mt-2.5 pt-2 border-t border-white/5 text-[9px] text-rose-400 font-mono break-words leading-relaxed bg-rose-950/20 p-2 rounded-xl border border-rose-900/25 max-h-28 overflow-y-auto scrollbar-thin">
              <span className="font-bold block text-rose-300 mb-0.5">Connection Issue:</span>
              {config.error}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
