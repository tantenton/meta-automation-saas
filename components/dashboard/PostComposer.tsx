'use client';

import { useState } from 'react';

interface PostFormData {
  caption: string;
  platform: 'instagram' | 'threads' | 'facebook';
  imageUrl: string;
  scheduledAt: string;
}

export default function PostComposer() {
  const [formData, setFormData] = useState<PostFormData>({
    caption: '',
    platform: 'instagram',
    imageUrl: '',
    scheduledAt: '',
  });
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (field: keyof PostFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAiGenerateCaption = async () => {
    if (!formData.imageUrl) {
      alert('Please provide an image URL first');
      return;
    }

    setIsAiGenerating(true);
    try {
      const response = await fetch('/api/ai/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: formData.imageUrl }),
      });

      if (response.ok) {
        const data = await response.json();
        setFormData((prev) => ({ ...prev, caption: data.caption }));
      } else {
        alert('Failed to generate caption');
      }
    } catch (error) {
      console.error('AI caption generation error:', error);
      alert('Error generating caption');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.caption.trim()) {
      alert('Please enter a caption');
      return;
    }
    if (!formData.scheduledAt) {
      alert('Please select a scheduled time');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/posts/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSuccess(true);
        setFormData({
          caption: '',
          platform: 'instagram',
          imageUrl: '',
          scheduledAt: '',
        });
        setTimeout(() => setSuccess(false), 3000);
      } else {
        alert('Failed to schedule post');
      }
    } catch (error) {
      console.error('Post scheduling error:', error);
      alert('Error scheduling post');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-slate-100 mb-4">Create New Post</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Platform
          </label>
          <select
            value={formData.platform}
            onChange={(e) => handleChange('platform', e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="instagram">Instagram</option>
            <option value="threads">Threads</option>
            <option value="facebook">Facebook</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Image URL
          </label>
          <input
            type="url"
            value={formData.imageUrl}
            onChange={(e) => handleChange('imageUrl', e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {formData.imageUrl && (
          <div className="flex gap-2">
            <button
              onClick={handleAiGenerateCaption}
              disabled={isAiGenerating}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isAiGenerating ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  Generating...
                </>
              ) : (
                <>
                  <span>✨</span>
                  AI Caption
                </>
              )}
            </button>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Caption
          </label>
          <textarea
            value={formData.caption}
            onChange={(e) => handleChange('caption', e.target.value)}
            placeholder="Write your post caption..."
            rows={4}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Schedule Date & Time
          </label>
          <input
            type="datetime-local"
            value={formData.scheduledAt}
            onChange={(e) => handleChange('scheduledAt', e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white font-medium px-4 py-3 rounded-lg transition-colors"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
              Scheduling...
            </span>
          ) : success ? (
            'Post Scheduled!'
          ) : (
            'Schedule Post'
          )}
        </button>
      </div>
    </div>
  );
}
