import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user/query";

const researchSchema = z.object({
  name: z.string().min(1),
  company: z.string().min(1),
  title: z.string().optional(),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = researchSchema.parse(body);

    // Determine the correct base URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   (req.headers.get('host')?.includes('localhost') 
                     ? `http://${req.headers.get('host')}`
                     : 'https://' + req.headers.get('host'));

    // Start research process
    const response = await fetch(`${baseUrl}/api/interviewer-research`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": req.headers.get("cookie") || "",
      },
      body: JSON.stringify({
        interviewers: [validatedData],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Research API error:", errorText);
      throw new Error("Failed to start research");
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("People research error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to start research" },
      { status: 500 }
    );
  }
}
