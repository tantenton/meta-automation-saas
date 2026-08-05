import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    // Mock AI caption generation - replace with actual AI service
    const captions = [
      "Amazing shot! Love the colors and composition.",
      "This is exactly what I needed to see today. Perfect!",
      "Capturing moments like these makes life beautiful.",
      "Never seen anything like this before. Stunning!",
    ];

    const randomCaption = captions[Math.floor(Math.random() * captions.length)];

    return NextResponse.json({ caption: randomCaption });
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate caption" }, { status: 500 });
  }
}
