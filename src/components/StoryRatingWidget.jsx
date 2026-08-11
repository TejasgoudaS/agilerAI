import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { Star, MessageSquare, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StoryRatingWidget({ story, sessionId }) {
  const { authToken } = useAppStore();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [saved, setSaved] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const authHeaders = { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) };

  const handleRate = async (value) => {
    setRating(value);
    if (!sessionId) return;
    try {
      const res = await fetch('/api/analytics/story-rating', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ session_id: sessionId, story_title: story.title, rating: value, feedback: feedback || null })
      });
      if (res.ok) {
        setSaved(true);
        toast.success('Rating saved — helps improve future estimates!', { duration: 2000 });
        setTimeout(() => setSaved(false), 3000);
      }
    } catch { }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(val => (
          <button
            key={val}
            onMouseEnter={() => setHover(val)}
            onMouseLeave={() => setHover(0)}
            onClick={() => handleRate(val)}
            className="p-0.5 cursor-pointer transition-transform hover:scale-110"
            title={['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][val]}
          >
            <Star
              className={`w-3.5 h-3.5 transition-colors ${val <= (hover || rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`}
            />
          </button>
        ))}
      </div>

      {rating > 0 && !saved && (
        <button onClick={() => setShowFeedback(!showFeedback)} className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer transition-colors flex items-center gap-1">
          <MessageSquare className="w-3 h-3" /> Add feedback
        </button>
      )}

      {saved && (
        <span className="flex items-center gap-1 text-xs text-emerald-400">
          <CheckCircle2 className="w-3 h-3" /> Saved
        </span>
      )}

      {showFeedback && (
        <div className="w-full mt-1 flex gap-2">
          <input
            type="text"
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="What could be improved?"
            className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 text-xs text-white rounded-lg focus:outline-none focus:border-indigo-500"
            onKeyDown={e => { if (e.key === 'Enter') { handleRate(rating); setShowFeedback(false); } }}
          />
          <button
            onClick={() => { handleRate(rating); setShowFeedback(false); }}
            className="px-2.5 py-1.5 bg-indigo-600 text-white text-xs rounded-lg cursor-pointer hover:bg-indigo-500 transition-colors"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
