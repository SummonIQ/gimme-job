// Import { put } from '@vercel/blob';
import { AppError, ErrorCode } from '@/lib/errors';
import { withApiErrorHandling } from '@/lib/errors/api';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

// Const nanoid = customAlphabet(
//   '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
//   7,
// ); // 7-character random string
// export async function POST(req: Request) {
//   const file = req.body || '';
//   const contentType = req.headers.get('content-type') || 'text/plain';
//   const filename = `${nanoid()}.${contentType.split('/')[1]}`;
//   const blob = await put(filename, file, {
//     access: 'public',
//     contentType,
//   });

//   return NextResponse.json(blob);
// }

const handlePOST = async (request: Request): Promise<NextResponse> => {
  let body: HandleUploadBody;

  try {
    body = (await request.json()) as HandleUploadBody;
  } catch (error) {
    throw new AppError({
      code: ErrorCode.INVALID_INPUT,
      message: 'Invalid JSON in request body',
      userMessage: 'Invalid request format. Please try again.',
      cause: error,
    });
  }

  const jsonResponse = await handleUpload({
    body,
    async onBeforeGenerateToken(pathname: string) {
      return {
        addRandomSuffix: true,
        allowedContentTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/svg+xml',
        ],
      };
    },
    async onUploadCompleted({ blob, tokenPayload }) {
      // Get notified of client upload completion
      // ⚠️ This will not work on `localhost` websites,
      // Use ngrok or similar to get the full upload flow

      try {
        // Run any logic after the file upload completed
        // const { userId } = JSON.parse(tokenPayload);
        // await db.update({ avatar: blob.url, userId });
      } catch (error) {
        throw new AppError({
          code: ErrorCode.FILE_UPLOAD_ERROR,
          message: 'Failed to complete upload processing',
          userMessage:
            'Upload completed but failed to process. Please try again.',
          cause: error,
          retryable: true,
        });
      }
    },
    request,
  });

  return NextResponse.json(jsonResponse);
};

export const POST = withApiErrorHandling(handlePOST);
