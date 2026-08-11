import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { Sparkles, Mail, Lock, User, ArrowRight, Eye, EyeOff, CheckCircle2, Network, Database, FolderGit2, Activity } from 'lucide-react';
import toast from 'react-hot-toast';

const FEATURE_HIGHLIGHTS = [
  { icon: Network, label: 'Multi-Agent AI Pipeline', desc: 'CrewAI-powered Architect, PM, Engineer agents' },
  { icon: FolderGit2, label: 'Codebase-Aware RAG', desc: 'Story points grounded in real file complexity' },
  { icon: Database, label: 'Persistent Session History', desc: 'Every sprint saved, searchable, restorable' },
  { icon: Activity, label: 'LLM Observability', desc: 'Token usage, cost & latency waterfall per agent' },
];

export default function LoginPage({ onAuthenticated }) {
  const { setAuthToken, setCurrentUser } = useAppStore();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { email, password } : { email, password, name };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.detail || 'Authentication failed');
        return;
      }

      // Store token
      localStorage.setItem('ai_jira_token', data.token);
      setAuthToken(data.token);
      setCurrentUser(data.user);
      toast.success(`Welcome${mode === 'register' ? ', your account is ready' : ' back'}, ${data.user.name}!`);
      onAuthenticated?.();
    } catch (e) {
      toast.error('Connection error. Is the server running?');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-slate-950 via-indigo-950/40 to-slate-950 flex-col justify-between p-12">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-[radial-gradient(ellipse,rgba(99,102,241,0.18),transparent_65%)]" />
          <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-[radial-gradient(ellipse,rgba(14,165,233,0.1),transparent_65%)]" />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(148,163,184,1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,1) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }} />
        </div>

        <div className="relative space-y-3">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-cyan-500 p-2.5 rounded-xl shadow-xl shadow-indigo-500/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold text-white tracking-tight">Agiler</span>
              <span className="text-xl font-light text-slate-400"> AI</span>
            </div>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">The Autonomous AI Agent for Agile Software Delivery</p>
        </div>

        <div className="relative space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              From requirements<br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">to sprint-ready Jira.</span>
            </h1>
            <p className="mt-3 text-slate-400 text-lg leading-relaxed max-w-md">
              Enterprise AI platform that indexes your codebase, grounds story points in real complexity, and syncs directly to Jira.
            </p>
          </div>

          <div className="space-y-3">
            {FEATURE_HIGHLIGHTS.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 group">
                <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg shrink-0 group-hover:border-indigo-500/40 transition-colors">
                  <Icon className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">{label}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-slate-600">
          Enterprise AI · CrewAI · RAG · Jira REST · GPT-4o
        </p>
      </div>

      {/* Right Panel — Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-6">
            <div className="bg-gradient-to-br from-indigo-500 to-cyan-500 p-2 rounded-xl">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">Agiler AI</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white">
              {mode === 'login' ? 'Sign in to your workspace' : 'Create your account'}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {mode === 'login'
                ? 'Enter your credentials to access your sprint sessions and team configuration.'
                : 'Set up your enterprise workspace in seconds.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    placeholder="Tejas Sankanagoudar"
                    className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 text-white rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 text-white rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full pl-10 pr-11 py-3 bg-slate-900 border border-slate-800 text-white rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 cursor-pointer transition-colors"
                >
                  {showPass ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2.5 shadow-lg shadow-indigo-600/25 transition-all duration-200 hover:shadow-indigo-600/40 hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="text-center">
            <button
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-sm text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
            >
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <span className="font-semibold text-indigo-400">
                {mode === 'login' ? 'Create one' : 'Sign in'}
              </span>
            </button>
          </div>

          <p className="text-center text-xs text-slate-600">
            API keys are encrypted and stored server-side. Never exposed to the browser.
          </p>
        </div>
      </div>
    </div>
  );
}
