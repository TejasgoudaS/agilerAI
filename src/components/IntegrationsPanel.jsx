import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { Plug, X, BookOpen, MessageSquare, Save, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export default function IntegrationsPanel() {
  const { isIntegrationsPanelOpen, setIsIntegrationsPanelOpen, authToken, currentSessionId } = useAppStore();
  const [tab, setTab] = useState('confluence');
  const [confluenceUrl, setConfluenceUrl] = useState('');
  const [spaceKey, setSpaceKey] = useState('');
  const [slackWebhook, setSlackWebhook] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [publishResult, setPublishResult] = useState(null);

  const authHeaders = { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) };

  const handleConfluencePublish = async () => {
    if (!currentSessionId) { toast.error('No active session to publish. Generate stories first.'); return; }
    if (!spaceKey) { toast.error('Enter a Confluence space key'); return; }
    setIsPublishing(true);
    try {
      const res = await fetch('/api/integrations/confluence/publish', {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ session_id: currentSessionId, space_key: spaceKey })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Publish failed');
      setPublishResult(data);
      toast.success('Sprint backlog published to Confluence!');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSlackTest = async () => {
    if (!slackWebhook) { toast.error('Enter a webhook URL'); return; }
    setIsTesting(true);
    try {
      const res = await fetch('/api/integrations/slack/notify', {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ webhook_url: slackWebhook, message: '✅ Agiler AI — Slack integration working!' })
      });
      if (res.ok) toast.success('Test message sent to Slack!');
      else toast.error('Slack test failed — check your webhook URL');
    } catch { toast.error('Connection error'); } finally { setIsTesting(false); }
  };

  if (!isIntegrationsPanelOpen) return null;

  const tabs = [
    { id: 'confluence', label: 'Confluence', icon: BookOpen },
    { id: 'slack', label: 'Slack / Teams', icon: MessageSquare },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Plug className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Integrations</h2>
              <p className="text-xs text-slate-400">Connect your team's toolchain</p>
            </div>
          </div>
          <button onClick={() => setIsIntegrationsPanelOpen(false)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors cursor-pointer ${tab === id ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {/* Confluence Tab */}
          {tab === 'confluence' && (
            <>
              <p className="text-sm text-slate-400">
                Auto-publish your sprint backlog as a beautifully formatted Confluence page — epics, stories, acceptance criteria, and cost summary.
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Space Key</label>
                  <input
                    value={spaceKey}
                    onChange={e => setSpaceKey(e.target.value.toUpperCase())}
                    placeholder="ENG, TEAM, PROJ"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 text-sm text-white rounded-xl font-mono focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                  />
                </div>
              </div>

              {publishResult && (
                <div className="flex items-center gap-3 bg-emerald-950/50 border border-emerald-500/30 rounded-xl p-3 animate-in fade-in duration-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-emerald-300">Published successfully!</p>
                    <a href={publishResult.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Open in Confluence
                    </a>
                  </div>
                </div>
              )}

              <button
                onClick={handleConfluencePublish}
                disabled={isPublishing || !spaceKey}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer transition-colors"
              >
                {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                {isPublishing ? 'Publishing...' : 'Publish to Confluence'}
              </button>
            </>
          )}

          {/* Slack Tab */}
          {tab === 'slack' && (
            <>
              <p className="text-sm text-slate-400">
                Send sprint-ready notifications to Slack or MS Teams whenever stories are generated or pushed to Jira.
              </p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Incoming Webhook URL</label>
                <input
                  value={slackWebhook}
                  onChange={e => setSlackWebhook(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 text-sm text-white rounded-xl focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                />
              </div>
              <a
                href="https://api.slack.com/messaging/webhooks"
                target="_blank" rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 flex items-center gap-1 w-fit"
              >
                <ExternalLink className="w-3 h-3" /> How to create a Slack webhook
              </a>
              <button
                onClick={handleSlackTest}
                disabled={isTesting || !slackWebhook}
                className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer transition-colors"
              >
                {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                Send Test Message
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
