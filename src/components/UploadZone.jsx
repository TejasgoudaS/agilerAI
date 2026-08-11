import { useState, useCallback } from 'react';
import { UploadCloud, FileText, CheckCircle2, X } from 'lucide-react';
import { parseFile } from '../lib/fileParser';
import { useAppStore } from '../store/appStore';
import toast from 'react-hot-toast';

export default function UploadZone({ onUploadComplete }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const { setPrdText, uploadedFileName, setUploadedFileName, prdText } = useAppStore();

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const processFile = async (file) => {
    try {
      setIsParsing(true);
      const text = await parseFile(file);
      if (!text || text.trim().length === 0) {
        throw new Error('Could not extract text from the document.');
      }
      setPrdText(text);
      setUploadedFileName(file.name);
      toast.success('PRD parsed successfully!');
      if (onUploadComplete) onUploadComplete();
    } catch (error) {
      toast.error('Failed to parse file: ' + error.message);
    } finally {
      setIsParsing(false);
    }
  };

  const clearFile = (e) => {
    e.stopPropagation();
    setPrdText('');
    setUploadedFileName(null);
    // reset the file input
    const input = document.getElementById('file-upload');
    if (input) input.value = '';
  };

  // Uploaded success state
  if (uploadedFileName && prdText) {
    return (
      <div className="relative w-full max-w-2xl p-8 border-2 border-emerald-500/60 bg-emerald-500/5 rounded-2xl flex items-center gap-5">
        <div className="w-14 h-14 flex-shrink-0 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-emerald-400 mb-0.5">Document Uploaded Successfully</p>
          <p className="text-base font-semibold text-slate-100 truncate">{uploadedFileName}</p>
          <p className="text-xs text-slate-400 mt-0.5">Ready to generate Agile plan</p>
        </div>
        <button
          onClick={clearFile}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          title="Remove file"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full max-w-2xl p-12 border-2 border-dashed rounded-2xl transition-all duration-300 ease-in-out flex flex-col items-center justify-center text-center
        ${isDragging
          ? 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(99,102,241,0.2)]'
          : 'border-slate-600 bg-surface/50 hover:border-primary/50'
        }
      `}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        id="file-upload"
        className="hidden"
        accept=".pdf,.docx,.txt"
        onChange={handleFileChange}
      />

      {isParsing ? (
        <div className="flex flex-col items-center animate-pulse">
          <FileText className="w-16 h-16 text-primary mb-4" />
          <p className="text-xl font-semibold text-slate-200">Parsing Document...</p>
          <p className="text-sm text-slate-400 mt-1">Extracting text from your file</p>
        </div>
      ) : (
        <>
          <div className={`w-16 h-16 mb-4 rounded-2xl flex items-center justify-center ${isDragging ? 'bg-primary/20' : 'bg-slate-800'}`}>
            <UploadCloud className={`w-8 h-8 ${isDragging ? 'text-primary' : 'text-slate-400'}`} />
          </div>
          <h3 className="text-xl font-semibold text-slate-200 mb-2">
            Upload PRD Document
          </h3>
          <p className="text-slate-400 mb-6 text-sm">
            Drag and drop your <span className="text-slate-300 font-medium">PDF, DOCX, or TXT</span> file here, or click to browse
          </p>
          <label
            htmlFor="file-upload"
            className="cursor-pointer bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-full font-medium transition-colors shadow-lg shadow-primary/20"
          >
            Select File
          </label>
        </>
      )}
    </div>
  );
}
