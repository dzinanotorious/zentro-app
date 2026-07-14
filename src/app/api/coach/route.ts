import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: body.message,
    });

    return NextResponse.json({
      reply: response.output_text,
    });
} catch (error) {
    console.error(error);
  
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
  
}
