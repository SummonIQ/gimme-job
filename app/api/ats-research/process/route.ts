import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user/query";
import { withRateLimit } from "@/lib/rate-limit/middleware";

// POST - Process a research job (call this from the background or via cron)
export async function POST(req: NextRequest) {
  // Rate limit SerpAPI batch processing to prevent runaway loops
  const rateLimitError = await withRateLimit(req, {
    preset: 'serpApiBatch',
    message: 'Too many ATS research requests. Please wait before trying again.',
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await req.json();

    const job = await db.aTSAnalysisJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.status !== "pending") {
      return NextResponse.json({ error: "Job already processed" }, { status: 400 });
    }

    // Update status to running
    await db.aTSAnalysisJob.update({
      where: { id: jobId },
      data: { status: "running" },
    });

    // Start processing in background (non-blocking)
    processJobInBackground(jobId, job.searchQueries, job.totalUrls);

    return NextResponse.json({ success: true, message: "Processing started" });
  } catch (error) {
    console.error("Error starting job processing:", error);
    return NextResponse.json(
      { error: "Failed to process job" },
      { status: 500 }
    );
  }
}

async function processJobInBackground(jobId: string, searchQueries: string[], maxUrls: number) {
  try {
    const serpApiKey = process.env.SERP_API_SECRET;
    if (!serpApiKey) {
      throw new Error("SERP_API_SECRET not configured");
    }

    const allUrls: string[] = [];
    
    // Collect job URLs from SerpAPI searches
    for (const query of searchQueries) {
      try {
        // Search for job postings
        const searchUrl = `https://serpapi.com/search.json?engine=google_jobs&q=${encodeURIComponent(query)}&api_key=${serpApiKey}`;
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (searchData.jobs_results) {
          for (const job of searchData.jobs_results) {
            if (job.apply_options) {
              for (const option of job.apply_options) {
                if (option.link && !allUrls.includes(option.link)) {
                  allUrls.push(option.link);
                }
              }
            }
            // Also check for direct application links
            if (job.share_url && !allUrls.includes(job.share_url)) {
              allUrls.push(job.share_url);
            }
          }
        }

        // Throttle to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (allUrls.length >= maxUrls) {
          break;
        }
      } catch (error) {
        console.error(`Error searching for "${query}":`, error);
      }
    }

    // Limit to maxUrls
    const urlsToProcess = allUrls.slice(0, maxUrls);

    // Update job with total URLs found
    await db.aTSAnalysisJob.update({
      where: { id: jobId },
      data: { totalUrls: urlsToProcess.length },
    });

    // Process each URL
    for (let i = 0; i < urlsToProcess.length; i++) {
      const url = urlsToProcess[i];
      
      try {
        // Call the analyze endpoint
        const analyzeResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ats-research/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, jobId }),
        });

        if (analyzeResponse.ok) {
          const result = await analyzeResponse.json();
          console.log(`Analyzed ${url}: ${result.atsSystem}`);
        }

        // Update progress
        const progress = ((i + 1) / urlsToProcess.length) * 100;
        await db.aTSAnalysisJob.update({
          where: { id: jobId },
          data: { 
            processedUrls: i + 1,
            progress,
          },
        });

        // Throttle requests to avoid overwhelming servers
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Error analyzing ${url}:`, error);
      }
    }

    // Mark job as completed
    await db.aTSAnalysisJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        completedAt: new Date(),
        progress: 100,
      },
    });

    console.log(`Job ${jobId} completed. Processed ${urlsToProcess.length} URLs.`);
  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    
    // Mark job as failed
    await db.aTSAnalysisJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date(),
      },
    });
  }
}
