'use client';

import { useState, useEffect, useMemo } from 'react';

interface Post {
  id: string;
  platform: 'instagram' | 'threads' | 'facebook';
  caption: string;
  imageUrl?: string;
  scheduledAt: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
}

interface CalendarDay {
  date: Date;
  hasPosts: boolean;
  posts: Post[];
}

export default function PostCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await fetch('/api/posts/list');
        if (response.ok) {
          const data = await response.json();
          setPosts(data.posts || []);
        }
      } catch (error) {
        console.error('Error fetching posts:', error);
      }
    };

    fetchPosts();
  }, []);

  const days = useMemo<CalendarDay[]>(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startingDayOfWeek = firstDayOfMonth.getDay();

    const calendarDays: CalendarDay[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      calendarDays.push({ date: new Date(year, month, i - startingDayOfWeek + 1), hasPosts: false, posts: [] });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayPosts = posts.filter((post) => {
        const postDate = new Date(post.scheduledAt);
        return (
          postDate.getDate() === day &&
          postDate.getMonth() === month &&
          postDate.getFullYear() === year
        );
      });

      calendarDays.push({
        date,
        hasPosts: dayPosts.length > 0,
        posts: dayPosts,
      });
    }

    return calendarDays;
  }, [currentDate, posts]);

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getDayName = (dayIndex: number) => {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex];
  };

  const getMonthName = (monthIndex: number) => {
    return [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ][monthIndex];
  };

  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-slate-600',
      scheduled: 'bg-blue-600',
      published: 'bg-emerald-600',
      failed: 'bg-red-600',
    };
    return colors[status as keyof typeof colors] || 'bg-slate-600';
  };

  const getPlatformColor = (platform: string) => {
    const colors = {
      instagram: 'bg-pink-600',
      threads: 'bg-orange-600',
      facebook: 'bg-blue-700',
    };
    return colors[platform as keyof typeof colors] || 'bg-slate-600';
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-100">Post Calendar</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={prevMonth}
            className="text-slate-400 hover:text-slate-100 transition-colors"
          >
            ←
          </button>
          <span className="text-slate-100 font-medium">
            {getMonthName(currentDate.getMonth())} {currentDate.getFullYear()}
          </span>
          <button
            onClick={nextMonth}
            className="text-slate-400 hover:text-slate-100 transition-colors"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-sm text-slate-400 font-medium py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day, index) => {
          const isCurrentMonth = day.date.getMonth() === currentDate.getMonth();
          const isToday =
            day.date.getDate() === new Date().getDate() &&
            day.date.getMonth() === new Date().getMonth() &&
            day.date.getFullYear() === new Date().getFullYear();

          return (
            <div
              key={index}
              className={`min-h-[100px] bg-slate-950 border border-slate-800 rounded-lg p-2 transition-colors ${
                !isCurrentMonth ? 'opacity-30' : ''
              } ${isToday ? 'ring-2 ring-indigo-500' : ''}`}
            >
              <div className="text-sm text-slate-300 mb-2 text-right">
                {day.date.getDate()}
              </div>
              {day.hasPosts &&
                day.posts.map((post) => (
                  <div
                    key={post.id}
                    className={`text-xs p-1.5 rounded mb-1 truncate ${
                      getPlatformColor(post.platform)
                    } bg-opacity-20`}
                  >
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${getStatusColor(
                        post.status
                      )}`}
                    ></span>
                    {post.platform}
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
