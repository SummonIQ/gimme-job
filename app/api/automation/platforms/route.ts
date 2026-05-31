import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { JobProvider } from '@/generated/prisma/browser';
import { 
  detectPlatform, 
  getPlatformCapabilities, 
  validateForAutomation 
} from '@/lib/applications/services/platform-detection';
import { 
  getFieldMapping, 
  validateFormData 
} from '@/lib/applications/services/field-mapping';
import { 
  checkEligibility, 
  previewApplication 
} from '@/lib/applications/services/unified-application';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const jobUrl = searchParams.get('jobUrl');
    const platform = searchParams.get('platform');
    const jobLeadId = searchParams.get('jobLeadId');

    switch (action) {
      case 'detect':
        return handlePlatformDetection(jobUrl);
      
      case 'capabilities':
        return handlePlatformCapabilities(platform);
      
      case 'fields':
        return handleFieldMapping(platform);
      
      case 'validate':
        return handleValidation(jobUrl);
      
      case 'eligibility':
        return await handleEligibilityCheck(jobLeadId, user.id);
      
      case 'preview':
        return await handleApplicationPreview(jobLeadId, user.id);
      
      case 'list':
      default:
        return handlePlatformList();
    }
  } catch (error) {
    console.error('Platform API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function handlePlatformDetection(jobUrl: string | null) {
  if (!jobUrl) {
    return NextResponse.json(
      { error: 'jobUrl parameter is required' },
      { status: 400 }
    );
  }

  const detection = detectPlatform(jobUrl);
  const validation = validateForAutomation(jobUrl);
  const capabilities = getPlatformCapabilities(detection.platform);

  return NextResponse.json({
    detection,
    validation,
    capabilities,
  });
}

function handlePlatformCapabilities(platform: string | null) {
  if (!platform) {
    return NextResponse.json(
      { error: 'platform parameter is required' },
      { status: 400 }
    );
  }

  const jobProvider = platform.toUpperCase() as JobProvider;
  if (!Object.values(JobProvider).includes(jobProvider)) {
    return NextResponse.json(
      { error: 'Invalid platform' },
      { status: 400 }
    );
  }

  const capabilities = getPlatformCapabilities(jobProvider);
  return NextResponse.json({ platform: jobProvider, capabilities });
}

function handleFieldMapping(platform: string | null) {
  if (!platform) {
    return NextResponse.json(
      { error: 'platform parameter is required' },
      { status: 400 }
    );
  }

  const jobProvider = platform.toUpperCase() as JobProvider;
  if (!Object.values(JobProvider).includes(jobProvider)) {
    return NextResponse.json(
      { error: 'Invalid platform' },
      { status: 400 }
    );
  }

  const mapping = getFieldMapping(jobProvider);
  return NextResponse.json(mapping);
}

function handleValidation(jobUrl: string | null) {
  if (!jobUrl) {
    return NextResponse.json(
      { error: 'jobUrl parameter is required' },
      { status: 400 }
    );
  }

  const validation = validateForAutomation(jobUrl);
  return NextResponse.json(validation);
}

async function handleEligibilityCheck(jobLeadId: string | null, userId: string) {
  if (!jobLeadId) {
    return NextResponse.json(
      { error: 'jobLeadId parameter is required' },
      { status: 400 }
    );
  }

  const eligibility = await checkEligibility(jobLeadId, userId);
  return NextResponse.json(eligibility);
}

async function handleApplicationPreview(jobLeadId: string | null, userId: string) {
  if (!jobLeadId) {
    return NextResponse.json(
      { error: 'jobLeadId parameter is required' },
      { status: 400 }
    );
  }

  const preview = await previewApplication({
    jobLeadId,
    userId,
  });
  return NextResponse.json(preview);
}

function handlePlatformList() {
  const platforms = Object.values(JobProvider).map(platform => {
    const capabilities = getPlatformCapabilities(platform);
    const mapping = getFieldMapping(platform);
    
    return {
      platform,
      name: platform.charAt(0) + platform.slice(1).toLowerCase().replace(/_/g, ' '),
      capabilities,
      requiredFields: mapping.requiredFields,
      totalFields: mapping.fields.length,
      implementationStatus: capabilities.automationSupported ? 'implemented' : 'planned',
    };
  });

  // Sort by implementation status and then by name
  platforms.sort((a, b) => {
    if (a.implementationStatus !== b.implementationStatus) {
      return a.implementationStatus === 'implemented' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json({
    platforms,
    summary: {
      total: platforms.length,
      implemented: platforms.filter(p => p.implementationStatus === 'implemented').length,
      planned: platforms.filter(p => p.implementationStatus === 'planned').length,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, platform, formData } = body;

    if (action === 'validate-form') {
      return handleFormValidation(platform, formData);
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Platform API POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function handleFormValidation(platform: string, formData: Record<string, any>) {
  if (!platform || !formData) {
    return NextResponse.json(
      { error: 'platform and formData are required' },
      { status: 400 }
    );
  }

  const jobProvider = platform.toUpperCase() as JobProvider;
  if (!Object.values(JobProvider).includes(jobProvider)) {
    return NextResponse.json(
      { error: 'Invalid platform' },
      { status: 400 }
    );
  }

  const validation = validateFormData(jobProvider, formData);
  return NextResponse.json({
    platform: jobProvider,
    validation,
  });
}