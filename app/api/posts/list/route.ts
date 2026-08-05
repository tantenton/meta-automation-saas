import { NextResponse } from "next/server";

export async function GET() {
  // Mock data - replace with actual database query
  const posts = [
    {
      id: "1",
      platform: "instagram" as const,
      caption: "Check out this amazing sunset! 🌅 #sunset #nature",
      imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4",
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      status: "scheduled" as const,
    },
    {
      id: "2",
      platform: "threads" as const,
      caption: "Just launched my new portfolio website! Check it out.",
      imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f",
      scheduledAt: new Date(Date.now() + 172800000).toISOString(),
      status: "scheduled" as const,
    },
  ];

  return NextResponse.json({ posts });
}
