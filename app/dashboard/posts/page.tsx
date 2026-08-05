import PostComposer from '@/components/dashboard/PostComposer';
import PostCard from '@/components/dashboard/PostCard';
import PostCalendar from '@/components/dashboard/PostCalendar';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Posts - Meta Automation',
  description: 'Schedule and manage your social media posts',
};

export const dynamic = 'force-dynamic';

interface Post {
  id: string;
  platform: 'instagram' | 'threads' | 'facebook';
  caption: string;
  imageUrl?: string;
  scheduledAt: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
}

async function getPosts(): Promise<Post[]> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/posts/list`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (response.ok) {
      const data = await response.json();
      return data.posts || [];
    }
    return [];
  } catch (error) {
    console.error('Error fetching posts:', error);
    return [];
  }
}

export default async function PostsPage() {
  const posts = await getPosts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Posts</h1>
        <div className="text-sm text-slate-400">
          {posts.length} {posts.length === 1 ? 'post' : 'posts'} scheduled
        </div>
      </div>

      <PostComposer />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {posts.length > 0 ? (
            posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))
          ) : (
            <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-xl">
              <p className="text-slate-400">No posts scheduled yet</p>
              <p className="text-sm text-slate-500 mt-1">
                Use the composer above to create your first post
              </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <PostCalendar />
        </div>
      </div>
    </div>
  );
}
