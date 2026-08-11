import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { Terminal, X, Copy, Download, RefreshCw, Check, Code, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TestGeneratorModal() {
  const { isTestModalOpen, setIsTestModalOpen, selectedStoryForTest } = useAppStore();
  const [framework, setFramework] = useState('playwright');
  const [testCode, setTestCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isTestModalOpen && selectedStoryForTest) {
      generateTestCode(framework);
    }
  }, [isTestModalOpen, selectedStoryForTest]);

  const generateTestCode = async (targetFramework) => {
    if (!selectedStoryForTest) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story: selectedStoryForTest,
          framework: targetFramework
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTestCode(data.code);
      } else {
        toast.error(data.detail || "Failed to generate tests");
      }
    } catch (e) {
      toast.error("Error generating test suite");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFrameworkChange = (newFramework) => {
    setFramework(newFramework);
    generateTestCode(newFramework);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(testCode);
    setCopied(true);
    toast.success("Test suite code copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = framework === 'playwright' ? 'spec.ts' : 'test.py';
    const filename = `${selectedStoryForTest?.id || 'story'}_${framework}.${ext}`;
    const blob = new Blob([testCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  if (!isTestModalOpen || !selectedStoryForTest) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-white">Automated BDD Test Generator</h2>
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs font-mono">
                  {selectedStoryForTest.id}
                </span>
              </div>
              <p className="text-sm text-slate-400 truncate max-w-[500px]">
                {selectedStoryForTest.title}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setIsTestModalOpen(false)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls & Code Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            {/* Framework Selector */}
            <div className="flex gap-2 p-1 bg-slate-950 border border-slate-800 rounded-xl">
              <button
                onClick={() => handleFrameworkChange('playwright')}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  framework === 'playwright' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Playwright (TypeScript)
              </button>
              <button
                onClick={() => handleFrameworkChange('pytest')}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  framework === 'pytest' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                PyTest (Python)
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                disabled={isGenerating || !testCode}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
              <button
                onClick={handleDownload}
                disabled={isGenerating || !testCode}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-indigo-600/20"
              >
                <Download className="w-3.5 h-3.5" />
                Download File
              </button>
            </div>
          </div>

          {/* Code Viewer */}
          <div className="relative rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-slate-800 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-purple-400" />
                {framework === 'playwright' ? `${selectedStoryForTest.id}.spec.ts` : `test_${selectedStoryForTest.id}.py`}
              </span>
              <span>Generated from Acceptance Criteria</span>
            </div>

            {isGenerating ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-400" />
                <p className="text-sm font-medium text-slate-200">Synthesizing BDD Test Automation Suite...</p>
              </div>
            ) : (
              <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto max-h-[450px] leading-relaxed">
                <code>{testCode}</code>
              </pre>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={() => setIsTestModalOpen(false)}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
