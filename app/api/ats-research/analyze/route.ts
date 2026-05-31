import { type NextRequest, NextResponse } from "next/server";
import {
  PlaywrightUnavailableError,
  requireChromium,
} from "@/lib/browser/playwright-runtime";
import { db } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user/query";

interface ATSDetectionResult {
  name: string;
  detectedDomain?: string;
  uniqueIdentifiers: Record<string, any>;
  commonStructures: Record<string, any>;
  formPatterns: Record<string, any>;
  fieldMappings: Record<string, any>;
  nuances: string[];
  networkAnalysis?: Record<string, any>;
  scripts?: string[];
  styles?: string[];
  hiddenFields?: any[];
  resumeFields?: any[];
  metaTags?: any[];
  aiInsights?: {
    visualAnalysis: string;
    uxPatterns: string[];
    automationDifficulty: string;
    estimatedSteps: number;
    keyObservations: string[];
    recommendedApproach: string;
  };
}

// POST - Analyze a specific job URL
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url, jobId } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL required" }, { status: 400 });
    }

    const chromium = await requireChromium('ATS research analyzer');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Navigate to the job posting
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      
      // Wait a bit for any dynamic content
      await page.waitForTimeout(2000);

      // Take screenshots for AI analysis
      const screenshot = await page.screenshot({ fullPage: false }); // Above fold
      const fullPageScreenshot = await page.screenshot({ fullPage: true });
      
      // Get full HTML
      const html = await page.content();
      
      // Get visible text
      const textContent = await page.evaluate(() => document.body.innerText);

      // Detect ATS system with traditional methods
      const atsResult = await detectATSSystem(page, url);
      
      if (atsResult) {
        // Enhance with AI analysis
        const aiAnalysis = await analyzeWithAI(screenshot, html, textContent, url);
        
        // Merge AI insights into result
        if (aiAnalysis) {
          atsResult.aiInsights = aiAnalysis;
        }
        // Update or create ATS system record
        await upsertATSSystem(atsResult);

        // Update job progress if provided
        if (jobId) {
          await db.aTSAnalysisJob.update({
            where: { id: jobId },
            data: {
              processedUrls: { increment: 1 },
              foundSystems: { increment: 1 },
            },
          });
        }
      }

      await browser.close();

      return NextResponse.json({ 
        success: true, 
        atsSystem: atsResult?.name || "Unknown",
        analyzed: true,
      });
    } catch (error) {
      await browser.close();
      throw error;
    }
  } catch (error) {
    if (error instanceof PlaywrightUnavailableError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 503 },
      );
    }
    console.error("Error analyzing ATS:", error);
    return NextResponse.json(
      { error: "Failed to analyze" },
      { status: 500 }
    );
  }
}

async function detectATSSystem(page: any, url: string): Promise<ATSDetectionResult | null> {
  const hostname = new URL(url).hostname;
  
  // Capture network requests
  const networkRequests: any[] = [];
  const xhrCalls: any[] = [];
  
  page.on('request', (request: any) => {
    networkRequests.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      resourceType: request.resourceType(),
    });
  });

  page.on('response', (response: any) => {
    const request = response.request();
    if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
      xhrCalls.push({
        url: request.url(),
        method: request.method(),
        status: response.status(),
        headers: response.headers(),
      });
    }
  });
  
  // Collect page data
  const pageData = await page.evaluate(() => {
    // Get all form elements with more detail
    const forms = Array.from(document.querySelectorAll('form')).map(form => ({
      id: form.id,
      className: form.className,
      action: form.action,
      method: form.method,
      enctype: (form as HTMLFormElement).enctype,
      target: (form as HTMLFormElement).target,
    }));

    // Get all input fields with more detail
    const inputs = Array.from(document.querySelectorAll('input, textarea, select')).map((el: any) => ({
      type: el.type,
      name: el.name,
      id: el.id,
      className: el.className,
      placeholder: el.placeholder,
      required: el.required,
      autocomplete: el.autocomplete,
      pattern: el.pattern,
      maxLength: el.maxLength,
      accept: el.accept, // For file inputs
    }));

    // Get hidden fields
    const hiddenFields = Array.from(document.querySelectorAll('input[type="hidden"]')).map((el: any) => ({
      name: el.name,
      value: el.value,
      id: el.id,
    }));

    // Get all script tags
    const scripts = Array.from(document.querySelectorAll('script[src]')).map((script: any) => script.src);
    
    // Get all stylesheets
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((link: any) => link.href);

    // Get meta tags
    const metas = Array.from(document.querySelectorAll('meta')).map((meta: any) => ({
      name: meta.name,
      property: meta.property,
      content: meta.content,
      httpEquiv: meta.httpEquiv,
    }));

    // Get cookies
    const cookies = document.cookie;

    // Get common identifiers
    const bodyClasses = document.body.className;
    const bodyId = document.body.id;
    const dataAttributes = Array.from(document.body.attributes)
      .filter(attr => attr.name.startsWith('data-'))
      .map(attr => ({ name: attr.name, value: attr.value }));

    // Check for common ATS-specific elements
    const hasReactRoot = !!document.getElementById('root') || !!document.getElementById('react-root');
    const hasAngular = !!document.querySelector('[ng-app]') || !!document.querySelector('[data-ng-app]');
    const hasVue = !!document.querySelector('[v-app]') || !!document.querySelector('[data-v-app]');

    return {
      forms,
      inputs,
      hiddenFields,
      scripts,
      styles,
      metas,
      cookies,
      bodyClasses,
      bodyId,
      dataAttributes,
      hasReactRoot,
      hasAngular,
      hasVue,
      title: document.title,
      url: window.location.href,
    };
  });

  // Detect ATS based on patterns
  let atsName = "Unknown";
  const uniqueIdentifiers: Record<string, any> = {};
  const nuances: string[] = [];

  // Greenhouse detection
  if (hostname.includes('greenhouse.io') || 
      hostname.includes('boards.greenhouse.io') ||
      pageData.bodyClasses.includes('greenhouse') ||
      pageData.scripts.some((s: string) => s.includes('greenhouse')) ||
      pageData.dataAttributes.some((attr: any) => attr.name.includes('greenhouse'))) {
    atsName = "Greenhouse";
    uniqueIdentifiers.domain = "greenhouse.io";
    uniqueIdentifiers.bodyClasses = ["greenhouse"];
    uniqueIdentifiers.scriptPatterns = ["greenhouse"];
    nuances.push("Uses greenhouse.io or boards.greenhouse.io domain");
    nuances.push("Typically has consistent form structure with predictable field names");
    nuances.push("API endpoints usually at /embed/job_app");
    nuances.push("File uploads use multipart/form-data");
  }
  
  // Lever detection
  else if (hostname.includes('lever.co') ||
           hostname.includes('jobs.lever.co') ||
           pageData.bodyClasses.includes('lever') ||
           pageData.scripts.some((s: string) => s.includes('lever')) ||
           pageData.title.includes('Lever')) {
    atsName = "Lever";
    uniqueIdentifiers.domain = "lever.co";
    uniqueIdentifiers.scriptPatterns = ["lever"];
    nuances.push("Uses lever.co or jobs.lever.co domain");
    nuances.push("Modern React-based interface");
    nuances.push("Often has real-time validation");
    nuances.push("Progressive application flow");
  }
  
  // Workday detection
  else if (hostname.includes('myworkdayjobs.com') ||
           hostname.includes('workday.com') ||
           pageData.bodyClasses.includes('workday') ||
           pageData.scripts.some((s: string) => s.includes('workday')) ||
           pageData.dataAttributes.some((attr: any) => attr.value.includes('workday'))) {
    atsName = "Workday";
    uniqueIdentifiers.domain = "myworkdayjobs.com";
    uniqueIdentifiers.scriptPatterns = ["workday"];
    nuances.push("Uses myworkdayjobs.com subdomain");
    nuances.push("Complex multi-step application process (typically 3-5 steps)");
    nuances.push("Heavy JavaScript, requires 3-5 second wait times");
    nuances.push("CSRF tokens required in hidden fields");
    nuances.push("Session management is strict");
  }
  
  // Taleo detection
  else if (hostname.includes('taleo.net') ||
           hostname.includes('tbe.taleo.net') ||
           pageData.metas.some((m: any) => m.content?.includes('Taleo'))) {
    atsName = "Taleo";
    uniqueIdentifiers.domain = "taleo.net";
    uniqueIdentifiers.metaPatterns = ["Taleo"];
    nuances.push("Oracle Taleo - older legacy system");
    nuances.push("Often has session management issues - sessions expire quickly");
    nuances.push("Multi-page form with server-side state");
    nuances.push("Requires navigation through multiple redirects");
  }
  
  // iCIMS detection
  else if (hostname.includes('icims.com') ||
           hostname.includes('careers.icims.com') ||
           pageData.bodyClasses.includes('icims') ||
           pageData.scripts.some((s: string) => s.includes('icims'))) {
    atsName = "iCIMS";
    uniqueIdentifiers.domain = "icims.com";
    uniqueIdentifiers.scriptPatterns = ["icims"];
    nuances.push("iCIMS Talent Cloud platform");
    nuances.push("Uses AJAX for form submission");
    nuances.push("Dynamic form fields based on job");
  }
  
  // BambooHR detection
  else if (hostname.includes('bamboohr.com') ||
           hostname.includes('recruiting.bamboohr.com') ||
           pageData.scripts.some((s: string) => s.includes('bamboohr'))) {
    atsName = "BambooHR";
    uniqueIdentifiers.domain = "bamboohr.com";
    uniqueIdentifiers.scriptPatterns = ["bamboohr"];
    nuances.push("BambooHR recruiting module");
    nuances.push("Simple form structure");
    nuances.push("Good for small-to-medium businesses");
  }

  // SmartRecruiters detection
  else if (hostname.includes('smartrecruiters.com') ||
           hostname.includes('jobs.smartrecruiters.com') ||
           pageData.scripts.some((s: string) => s.includes('smartrecruiters')) ||
           pageData.dataAttributes.some((attr: any) => attr.value.includes('smartrecruiters'))) {
    atsName = "SmartRecruiters";
    uniqueIdentifiers.domain = "smartrecruiters.com";
    uniqueIdentifiers.scriptPatterns = ["smartrecruiters"];
    nuances.push("SmartRecruiters platform");
    nuances.push("Modern UI with good UX");
    nuances.push("Resume parsing capabilities");
  }
  
  // Workable detection
  else if (hostname.includes('workable.com') ||
           hostname.includes('apply.workable.com') ||
           pageData.scripts.some((s: string) => s.includes('workable')) ||
           pageData.bodyClasses.includes('workable')) {
    atsName = "Workable";
    uniqueIdentifiers.domain = "workable.com";
    uniqueIdentifiers.scriptPatterns = ["workable"];
    nuances.push("Workable ATS platform");
    nuances.push("Simple and clean interface");
    nuances.push("Straightforward form submission");
    nuances.push("Good API documentation");
  }
  
  // Pinpoint detection
  else if (hostname.includes('pinpointhq.com') ||
           hostname.includes('jobs.pinpointhq.com') ||
           pageData.scripts.some((s: string) => s.includes('pinpoint')) ||
           pageData.metas.some((m: any) => m.content?.includes('Pinpoint'))) {
    atsName = "Pinpoint";
    uniqueIdentifiers.domain = "pinpointhq.com";
    uniqueIdentifiers.scriptPatterns = ["pinpoint"];
    nuances.push("Pinpoint ATS platform");
    nuances.push("Modern European-based ATS");
    nuances.push("GDPR-compliant by design");
  }
  
  // Manatal detection
  else if (hostname.includes('manatal.com') ||
           pageData.scripts.some((s: string) => s.includes('manatal')) ||
           pageData.metas.some((m: any) => m.content?.includes('Manatal'))) {
    atsName = "Manatal";
    uniqueIdentifiers.domain = "manatal.com";
    uniqueIdentifiers.scriptPatterns = ["manatal"];
    nuances.push("Manatal recruitment software");
    nuances.push("AI-powered recommendations");
    nuances.push("Social media integration");
  }
  
  // Trakstar Hire (formerly RecruiterBox) detection
  else if (hostname.includes('trakstar.com') ||
           hostname.includes('recruiterbox.com') ||
           pageData.scripts.some((s: string) => s.includes('trakstar') || s.includes('recruiterbox'))) {
    atsName = "Trakstar Hire";
    uniqueIdentifiers.domain = "trakstar.com";
    uniqueIdentifiers.scriptPatterns = ["trakstar", "recruiterbox"];
    nuances.push("Trakstar Hire (formerly RecruiterBox)");
    nuances.push("SMB-focused ATS");
    nuances.push("Simple application flow");
  }
  
  // JazzHR detection
  else if (hostname.includes('jazz.co') ||
           hostname.includes('applytojob.com') ||
           pageData.scripts.some((s: string) => s.includes('jazz'))) {
    atsName = "JazzHR";
    uniqueIdentifiers.domain = "jazz.co";
    uniqueIdentifiers.scriptPatterns = ["jazz"];
    nuances.push("JazzHR platform");
    nuances.push("Uses applytojob.com for applications");
    nuances.push("Simple form-based applications");
  }
  
  // Ashby detection
  else if (hostname.includes('ashbyhq.com') ||
           hostname.includes('jobs.ashbyhq.com') ||
           pageData.scripts.some((s: string) => s.includes('ashby'))) {
    atsName = "Ashby";
    uniqueIdentifiers.domain = "ashbyhq.com";
    uniqueIdentifiers.scriptPatterns = ["ashby"];
    nuances.push("Ashby ATS - modern platform");
    nuances.push("Analytics-focused");
    nuances.push("Clean React-based UI");
  }

  // Extract field mappings
  const fieldMappings: Record<string, any> = {};
  const commonFields = ['firstName', 'lastName', 'email', 'phone', 'resume', 'coverLetter'];
  
  for (const field of commonFields) {
    const matchingInputs = pageData.inputs.filter((input: any) => 
      input.name?.toLowerCase().includes(field.toLowerCase()) ||
      input.id?.toLowerCase().includes(field.toLowerCase()) ||
      input.placeholder?.toLowerCase().includes(field.toLowerCase())
    );
    
    if (matchingInputs.length > 0) {
      fieldMappings[field] = matchingInputs.map((input: any) => ({
        selector: input.id ? `#${input.id}` : input.name ? `[name="${input.name}"]` : null,
        type: input.type,
        name: input.name,
        id: input.id,
      }));
    }
  }

  //  Analyze file upload fields
  const resumeFields = pageData.inputs.filter((input: any) => 
    input.type === 'file' && 
    (input.name?.toLowerCase().includes('resume') || 
     input.name?.toLowerCase().includes('cv') ||
     input.accept?.includes('pdf') ||
     input.accept?.includes('doc'))
  );

  const result: ATSDetectionResult = {
    name: atsName,
    detectedDomain: hostname,
    uniqueIdentifiers,
    commonStructures: {
      forms: pageData.forms,
      bodyClasses: pageData.bodyClasses,
      bodyId: pageData.bodyId,
      dataAttributes: pageData.dataAttributes,
      hasReactRoot: pageData.hasReactRoot,
      hasAngular: pageData.hasAngular,
      hasVue: pageData.hasVue,
    },
    formPatterns: {
      totalForms: pageData.forms.length,
      totalInputs: pageData.inputs.length,
      inputTypes: [...new Set(pageData.inputs.map((i: any) => i.type))],
      enctype: pageData.forms[0]?.enctype,
      method: pageData.forms[0]?.method,
    },
    fieldMappings,
    nuances,
    networkAnalysis: {
      totalRequests: networkRequests.length,
      xhrCalls: xhrCalls.slice(0, 10), // Store first 10 XHR calls
      apiEndpoints: [...new Set(xhrCalls.map((xhr: any) => {
        try {
          const xhrUrl = new URL(xhr.url);
          return xhrUrl.pathname;
        } catch {
          return xhr.url;
        }
      }))],
    },
    scripts: pageData.scripts.slice(0, 20), // Store first 20 scripts
    styles: pageData.styles.slice(0, 20), // Store first 20 stylesheets
    hiddenFields: pageData.hiddenFields,
    resumeFields: resumeFields.map((f: any) => ({
      name: f.name,
      id: f.id,
      accept: f.accept,
    })),
    metaTags: pageData.metas.filter((m: any) => m.name || m.property),
  };

  return result;
}

async function analyzeWithAI(screenshot: Buffer, html: string, textContent: string, url: string) {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.warn("OpenAI API key not configured, skipping AI analysis");
      return null;
    }

    // Convert screenshot to base64
    const screenshotBase64 = screenshot.toString('base64');
    
    // Use GPT-4 Vision to analyze the screenshot
    const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are analyzing a job application page to understand its structure for automation purposes.

Analyze this job application page screenshot and provide:
1. Visual design patterns (modern/legacy, clean/cluttered, etc.)
2. UX patterns observed (multi-step, single page, progressive disclosure, etc.)
3. Estimated difficulty for automation (Easy/Medium/Hard) with reasoning
4. Number of visible steps in the application process
5. Key observations about form layout, required fields visibility, button placement
6. Recommended approach for automation

Be specific and technical. Focus on what would help build an automated application system.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${screenshotBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      }),
    });

    if (!visionResponse.ok) {
      console.error('Vision API error:', await visionResponse.text());
      return null;
    }

    const visionData = await visionResponse.json();
    const visualAnalysis = visionData.choices[0]?.message?.content || '';

    // Use GPT-4 to analyze HTML structure
    const htmlResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: `Analyze this HTML from a job application page: ${url}

HTML snippet (first 5000 chars):
${html.substring(0, 5000)}

Page text content (first 2000 chars):
${textContent.substring(0, 2000)}

Provide a JSON response with:
{
  "uxPatterns": ["pattern1", "pattern2"],
  "automationDifficulty": "Easy|Medium|Hard",
  "estimatedSteps": number,
  "keyObservations": ["observation1", "observation2"],
  "recommendedApproach": "specific technical approach for automation"
}

Focus on technical details that would help automate form filling.`,
          },
        ],
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!htmlResponse.ok) {
      console.error('HTML analysis API error:', await htmlResponse.text());
      return null;
    }

    const htmlData = await htmlResponse.json();
    const htmlAnalysisText = htmlData.choices[0]?.message?.content || '{}';
    const htmlAnalysis = JSON.parse(htmlAnalysisText);

    return {
      visualAnalysis,
      uxPatterns: htmlAnalysis.uxPatterns || [],
      automationDifficulty: htmlAnalysis.automationDifficulty || 'Unknown',
      estimatedSteps: htmlAnalysis.estimatedSteps || 1,
      keyObservations: htmlAnalysis.keyObservations || [],
      recommendedApproach: htmlAnalysis.recommendedApproach || '',
    };
  } catch (error) {
    console.error('AI analysis error:', error);
    return null;
  }
}

async function upsertATSSystem(result: ATSDetectionResult) {
  const existing = await db.aTSSystem.findFirst({
    where: { name: result.name },
  });

  if (existing) {
    // Merge data intelligently
    const mergedStructures = {
      ...existing.commonStructures as any,
      ...result.commonStructures,
    };
    
    const mergedMappings = {
      ...existing.fieldMappings as any,
      ...result.fieldMappings,
    };

    const mergedNuances = [
      ...existing.nuances,
      ...result.nuances.filter(n => !existing.nuances.includes(n)),
    ];

    const mergedScripts = [
      ...existing.scriptUrls,
      ...(result.scripts || []).filter(s => !existing.scriptUrls.includes(s)),
    ].slice(0, 50); // Keep top 50

    const mergedStyles = [
      ...existing.styleUrls,
      ...(result.styles || []).filter(s => !existing.styleUrls.includes(s)),
    ].slice(0, 50);

    const mergedDomainPatterns = [
      ...existing.domainPatterns,
      ...(result.detectedDomain && !existing.domainPatterns.includes(result.detectedDomain) 
        ? [result.detectedDomain] 
        : []),
    ];

    await db.aTSSystem.update({
      where: { id: existing.id },
      data: {
        commonStructures: mergedStructures,
        formPatterns: result.formPatterns, // Use latest
        fieldMappings: mergedMappings,
        nuances: mergedNuances,
        domainPatterns: mergedDomainPatterns,
        scriptUrls: mergedScripts,
        styleUrls: mergedStyles,
        apiEndpoints: result.networkAnalysis,
        networkPatterns: result.networkAnalysis,
        xhrCalls: result.networkAnalysis,
        hiddenFields: result.hiddenFields,
        metaTags: result.metaTags,
        resumeFieldSelectors: result.resumeFields?.map(f => f.name || f.id).filter(Boolean) || [],
        supportedFileTypes: result.resumeFields?.map(f => f.accept).filter(Boolean) || [],
        aiVisualAnalysis: result.aiInsights?.visualAnalysis,
        aiUxPatterns: result.aiInsights?.uxPatterns || [],
        aiKeyObservations: result.aiInsights?.keyObservations || [],
        aiRecommendedApproach: result.aiInsights?.recommendedApproach,
        difficulty: result.aiInsights?.automationDifficulty,
        stepCount: result.aiInsights?.estimatedSteps,
        isMultiStep: (result.aiInsights?.estimatedSteps || 0) > 1,
        totalAnalyzed: { increment: 1 },
        lastAnalyzed: new Date(),
      },
    });
  } else {
    await db.aTSSystem.create({
      data: {
        name: result.name,
        detectedDomain: result.detectedDomain,
        domainPatterns: result.detectedDomain ? [result.detectedDomain] : [],
        uniqueIdentifiers: result.uniqueIdentifiers,
        commonStructures: result.commonStructures,
        formPatterns: result.formPatterns,
        fieldMappings: result.fieldMappings,
        nuances: result.nuances,
        scriptUrls: result.scripts || [],
        styleUrls: result.styles || [],
        apiEndpoints: result.networkAnalysis,
        networkPatterns: result.networkAnalysis,
        xhrCalls: result.networkAnalysis,
        hiddenFields: result.hiddenFields,
        metaTags: result.metaTags,
        resumeFieldSelectors: result.resumeFields?.map(f => f.name || f.id).filter(Boolean) || [],
        supportedFileTypes: result.resumeFields?.map(f => f.accept).filter(Boolean) || [],
        aiVisualAnalysis: result.aiInsights?.visualAnalysis,
        aiUxPatterns: result.aiInsights?.uxPatterns || [],
        aiKeyObservations: result.aiInsights?.keyObservations || [],
        aiRecommendedApproach: result.aiInsights?.recommendedApproach,
        difficulty: result.aiInsights?.automationDifficulty,
        stepCount: result.aiInsights?.estimatedSteps,
        isMultiStep: (result.aiInsights?.estimatedSteps || 0) > 1,
        requiredFields: [],
        optionalFields: [],
        totalAnalyzed: 1,
      },
    });
  }
}
