import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { caption, platform, imageUrl, scheduledAt } = body;

    // Validate required fields
    if (!caption || !platform || !scheduledAt) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Mock scheduling - replace with actual database insertion
    const newPost = {
      id: Math.random().toString(36).substr(2, 9),
      caption,
      platform,
      imageUrl: imageUrl || null,
      scheduledAt,
      status: "scheduled" as const,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({ post: newPost, message: "Post scheduled successfully" });
  } catch (error) {
    return NextResponse.json({ error: "Failed to schedule post" }, { status: 500 });
  }
}
