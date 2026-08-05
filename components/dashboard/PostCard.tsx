'use client';

interface PostCardProps {
  post: {
    id: string;
    platform: 'instagram' | 'threads' | 'facebook';
    caption: string;
    imageUrl?: string;
    scheduledAt: string;
    status: 'draft' | 'scheduled' | 'published' | 'failed';
  };
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export default function PostCard({ post, onEdit, onDelete }: PostCardProps) {
  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-slate-600 text-slate-100',
      scheduled: 'bg-blue-600 text-white',
      published: 'bg-emerald-600 text-white',
      failed: 'bg-red-600 text-white',
    };
    return colors[status as keyof typeof colors] || 'bg-slate-600 text-slate-100';
  };

  const getPlatformColor = (platform: string) => {
    const colors = {
      instagram: 'bg-pink-600 text-white',
      threads: 'bg-orange-600 text-white',
      facebook: 'bg-blue-700 text-white',
    };
    return colors[platform as keyof typeof colors] || 'bg-slate-600 text-white';
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateCaption = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${getPlatformColor(
              post.platform
            )}`}
          >
            {post.platform.charAt(0).toUpperCase() + post.platform.slice(1)}
          </span>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(
              post.status
            )}`}
          >
            {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
          </span>
        </div>
        <span className="text-sm text-slate-400">
          {formatDateTime(post.scheduledAt)}
        </span>
      </div>

      {post.imageUrl && (
        <div className="mb-3">
          <img
            src={post.imageUrl}
            alt="Post content"
            className="w-full h-48 object-cover rounded-lg border border-slate-800"
          />
        </div>
      )}

      <p className="text-slate-300 text-sm mb-4 line-clamp-3 font-light">
        {post.caption}
      </p>

      <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
        {onEdit && (
          <button
            onClick={() => onEdit(post.id)}
            className="text-sm text-slate-400 hover:text-indigo-400 px-3 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors"
          >
            Edit
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(post.id)}
            className="text-sm text-slate-400 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
