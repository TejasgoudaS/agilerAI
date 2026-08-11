import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { Settings, X, CheckCircle2, AlertTriangle, Eye, EyeOff, Save, Loader2, KeyRound, Database, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI GPT-4o', color: 'text-emerald-400', desc: 'Recommended — best accuracy' },
  { id: 'claude', label: 'Anthropic Claude 3.5', color: 'text-amber-400', desc: 'Excellent for long contexts' },
];

export default function SettingsModal() {
  const { isSettingsOpen, setIsSettingsOpen, authToken } = useAppStore();
  const [config, setConfig] = useState({
    llm_provider: 'openai',
    openai_key: '',
    anthropic_key: '',
    jira_base_url: '',
    jira_email: '',
    jira_token: '',
    jira_project_key: '',
  });
  const [showKeys, setShowKeys] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [configured, setConfigured] = useState(false);

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
  };

  useEffect(() => {
    if (isSettingsOpen) fetchSettings();
  }, [isSettingsOpen]);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/settings', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setConfigured(data.configured);
      }
    } catch (e) {
      toast.error('Could not load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Settings saved securely');
        setConfigured(true);
        setIsSettingsOpen(false);
      } else {
        toast.error(data.detail || 'Failed to save settings');
      }
    } catch {
      toast.error('Save failed — is the server running?');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleShow = (field) => setShowKeys(prev => ({ ...prev, [field]: !prev[field] }));

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Workspace Settings</h2>
              <p className="text-xs text-slate-400">API keys are encrypted AES-256 and stored server-side only</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {configured && (
              <span className="px-2.5 py-1 text-xs font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Configured
              </span>
            )}
            <button onClick={() => setIsSettingsOpen(false)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading configuration...</span>
            </div>
          ) : (
            <>
              {/* LLM Provider */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Zap className="w-3.5 h-3.5 text-indigo-400" /> LLM Provider
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {PROVIDERS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setConfig(c => ({ ...c, llm_provider: p.id }))}
                      className={`p-3.5 border rounded-xl text-left transition-all cursor-pointer ${
                        config.llm_provider === p.id
                          ? 'border-indigo-500/60 bg-indigo-500/10'
                          : 'border-slate-700/60 bg-slate-950/40 hover:border-slate-600'
                      }`}
                    >
                      <p className={`text-sm font-semibold ${p.color}`}>{p.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </section>

              {/* AI API Keys */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-400" /> AI API Keys (Encrypted Server-Side)
                </div>

                {[
                  { field: 'openai_key', label: 'OpenAI API Key', placeholder: 'sk-proj-...' },
                  { field: 'anthropic_key', label: 'Anthropic API Key', placeholder: 'sk-ant-...' },
                ].map(({ field, label, placeholder }) => (
                  <div key={field} className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-300">{label}</label>
                    <div className="relative">
                      <input
                        type={showKeys[field] ? 'text' : 'password'}
                        value={config[field] || ''}
                        onChange={e => setConfig(c => ({ ...c, [field]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full pr-11 pl-4 py-2.5 bg-slate-950 border border-slate-800 text-sm text-white rounded-xl focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShow(field)}
                        className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        {showKeys[field] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </section>

              {/* Jira Configuration */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Database className="w-3.5 h-3.5 text-indigo-400" /> Jira Configuration
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-sm font-medium text-slate-300">Jira Base URL</label>
                    <input
                      type="url"
                      value={config.jira_base_url || ''}
                      onChange={e => setConfig(c => ({ ...c, jira_base_url: e.target.value }))}
                      placeholder="https://yourcompany.atlassian.net"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 text-sm text-white rounded-xl focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-300">Jira Email</label>
                    <input
                      type="email"
                      value={config.jira_email || ''}
                      onChange={e => setConfig(c => ({ ...c, jira_email: e.target.value }))}
                      placeholder="you@company.com"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 text-sm text-white rounded-xl focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-300">Project Key</label>
                    <input
                      type="text"
                      value={config.jira_project_key || ''}
                      onChange={e => setConfig(c => ({ ...c, jira_project_key: e.target.value.toUpperCase() }))}
                      placeholder="SCRUM"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 text-sm text-white rounded-xl focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600 font-mono"
                    />
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <label className="text-sm font-medium text-slate-300">Jira API Token</label>
                    <div className="relative">
                      <input
                        type={showKeys.jira_token ? 'text' : 'password'}
                        value={config.jira_token || ''}
                        onChange={e => setConfig(c => ({ ...c, jira_token: e.target.value }))}
                        placeholder="ATATT3xFf..."
                        className="w-full pr-11 pl-4 py-2.5 bg-slate-950 border border-slate-800 text-sm text-white rounded-xl focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShow('jira_token')}
                        className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        {showKeys.jira_token ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
            Keys never leave the server — stored encrypted at rest
          </p>
          <div className="flex gap-3">
            <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
