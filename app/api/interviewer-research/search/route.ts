import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/user/query";

const searchSchema = z.object({
  role: z.string().min(1),
  company: z.string().min(1),
});

interface SearchResult {
  name: string;
  title: string;
  snippet?: string;
  linkedinUrl?: string;
  source: string;
}

// Search for people by role and company using SerpAPI
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { role, company } = searchSchema.parse(body);

    const serpApiKey = process.env.SERP_API_SECRET;
    if (!serpApiKey) {
      throw new Error("SERP_API_SECRET is not defined");
    }

    // Search for people with this role at the company on LinkedIn
    const query = `"${role}" "${company}" site:linkedin.com/in`;
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(
      query
    )}&api_key=${serpApiKey}&num=20`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      throw new Error(`SerpAPI error: ${data.error}`);
    }

    const results: SearchResult[] = [];
    const organicResults = data.organic_results || [];

    for (const result of organicResults) {
      // Extract name from LinkedIn URL or title
      let name = "";
      let title = result.title || "";
      
      // Try to extract name from LinkedIn URL pattern
      const linkedInMatch = result.link?.match(/linkedin\.com\/in\/([^/?]+)/);
      if (linkedInMatch) {
        // Convert linkedin slug to name (e.g., "john-doe" -> "John Doe")
        name = linkedInMatch[1]
          .split("-")
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
      }

      // Try to extract name from title (usually "Name - Title - Company | LinkedIn")
      const titleParts = title.split(" - ");
      if (titleParts.length > 0 && !name) {
        name = titleParts[0].trim();
      }

      // Extract job title from title or snippet
      let jobTitle = role; // Default to searched role
      if (titleParts.length > 1) {
        jobTitle = titleParts[1].trim();
      }

      if (name && result.link?.includes("linkedin.com/in/")) {
        results.push({
          name,
          title: jobTitle,
          snippet: result.snippet,
          linkedinUrl: result.link,
          source: "LinkedIn",
        });
      }
    }

    // Remove duplicates based on LinkedIn URL
    const uniqueResults = results.filter(
      (result, index, self) =>
        index === self.findIndex((r) => r.linkedinUrl === result.linkedinUrl)
    );

    return NextResponse.json({
      results: uniqueResults.slice(0, 10), // Limit to 10 results
      query: { role, company },
    });
  } catch (error) {
    console.error("Error searching for interviewers:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to search for interviewers" },
      { status: 500 }
    );
  }
}
