'use client';

import { upload } from '@vercel/blob/client';
import { FileUser, XIcon } from 'lucide-react';
import {
  type ChangeEvent,
  forwardRef,
  type SelectHTMLAttributes,
  useCallback,
  useEffect,
  useState,
} from 'react';

import { cn } from '@/lib/utils';

import { Button } from './button';
import { Progress } from './progress';

const getDisplayFileName = (fileName: string) => {
  const extensionMatch = fileName.match(/(\.[^./\\]+)$/);
  const extension = extensionMatch?.[1] ?? '';
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName;

  const sanitizedBaseName = baseName.replace(/-[A-Za-z0-9]{5,}$/, '');

  return `${sanitizedBaseName}${extension}`;
};

export type InputProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'onChange'
> & {
  contentTypes?: string;
  defaultValue?: string[];
  multiple?: boolean;
  onChange?: (value: string[] | string) => void;
  showPreview?: boolean;
  uploadUrlPath?: string;
};

const FileUploadInput = forwardRef<HTMLSelectElement, InputProps>(
  (
    {
      className,
      contentTypes = 'image/*, application/pdf',
      multiple = false,
      onChange,
      defaultValue,
      showPreview = false,
      uploadUrlPath = '',
      ...props
    },
    ref,
  ) => {
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadedFiles, setUploadedFiles] = useState<
      Array<{
        name: string;
        url: string;
      }>
    >([]);
    const [urls, setUrls] = useState<string[]>(defaultValue ?? []);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    useEffect(() => {
      if (onChange && multiple) {
        onChange(urls);
      } else if (onChange && urls.length > 0) {
        onChange(urls[0]);
      }
    }, [urls]);

    useEffect(() => {
      setUrls(uploadedFiles.map(f => f.url));
    }, [uploadedFiles]);

    const onFileChange = useCallback(
      async (event: ChangeEvent<HTMLInputElement>) => {
        setUploading(true);

        const { files } = event.currentTarget;
        let uploadPromises: Array<
          Promise<{
            blob: Awaited<ReturnType<typeof upload>>;
            originalName: string;
          }>
        > = [];

        const uploadFileUpload = async (file: File) => {
          if (!files) {
            return null;
          }

          const blob = await upload(`${uploadUrlPath}${file.name}`, file, {
            access: 'public',
            handleUploadUrl: '/api/upload',
            onUploadProgress(e) {
              setUploadProgress(e.percentage);
            },
          });

          return {
            blob,
            originalName: file.name,
          };
        };

        let index = 0;
        if (files && files.length > 0) {
          for (const newFileUpload of files) {
            index += 1;

            if (newFileUpload.size / 1024 / 1024 > 50) {
              // toast.error('FileUpload size too big (max 50MB)');
            } else {
              uploadPromises = [
                ...uploadPromises,
                uploadFileUpload(newFileUpload) as Promise<{
                  blob: Awaited<ReturnType<typeof upload>>;
                  originalName: string;
                }>,
              ];
            }
          }

          const newUploads = await Promise.all(uploadPromises);
          setUploadedFiles([
            ...uploadedFiles,
            ...newUploads.map(({ blob, originalName }) => ({
              name: originalName,
              url: blob.url,
            })),
          ]);

          setUploading(false);
          setUploadProgress(0);
        }
      },
      [urls],
    );

    return (
      <div className="flex w-full flex-col overflow-hidden rounded-lg border border-border/50 bg-input">
        <label
          className={cn(
            'group flex h-40 w-full cursor-pointer flex-col items-center justify-center border-b border-border/50 bg-input px-10 text-sm text-muted-foreground opacity-100 shadow-sm ring-offset-background transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground hover:bg-input/80 hover:text-foreground focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            urls.length > 0 && 'rounded-s-none',
            dragActive && 'border-2 border-border/50',
            uploading && 'hidden',
            !multiple && uploadedFiles.length === 1 ? 'hidden' : '',
            className,
          )}
          htmlFor="file-upload"
          onDragEnter={e => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(true);
          }}
          onDragLeave={e => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
          }}
          onDragOver={e => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(true);
          }}
          onDrop={async e => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);

            const { files } = e.dataTransfer;

            let uploadPromises: Array<
              Promise<{
                blob: Awaited<ReturnType<typeof upload>>;
                originalName: string;
              }>
            > = [];
            let updatedUploadedFiles = [...uploadedFiles];

            if (files && files.length > 0) {
              for (const newFileUpload of files) {
                if (newFileUpload.size / 1024 / 1024 > 50) {
                  console.error('FileUpload size too big (max 50MB)');
                  // toast.error('FileUpload size too big (max 50MB)');
                } else {
                  uploadPromises = [
                    ...uploadPromises,
                    upload(
                      `${uploadUrlPath}${newFileUpload.name}`,
                      newFileUpload,
                      {
                        access: 'public',
                        handleUploadUrl: '/api/upload',
                      },
                    ).then(blob => ({
                      blob,
                      originalName: newFileUpload.name,
                    })),
                  ];
                }
              }

              const newUploads = await Promise.all(uploadPromises);

              // Convert each blob to the expected format with name and url properties
              const formattedBlobs = newUploads.map(
                ({ blob, originalName }) => ({
                  name: originalName || 'file',
                  url: blob.url,
                }),
              );

              updatedUploadedFiles = [
                ...updatedUploadedFiles,
                ...formattedBlobs,
              ];

              setUploadedFiles(updatedUploadedFiles);
            }
          }}
        >
          <svg
            className={cn(
              'h-7 w-7 stroke-foreground transition-all duration-75 group-hover:stroke-foreground group-active:stroke-foreground/80',
              dragActive && 'scale-110 text-accent',
            )}
            fill="none"
            height="24"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>Drag and drop or click to upload.</title>
            <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
            <path d="M12 12v9" />
            <path d="m16 16-4-4-4 4" />
          </svg>

          <p className="mt-2 text-center text-sm text-foreground">
            Drag and drop or click to upload.
          </p>
          <p className="mt-2 text-center text-xs">Max file size: 50MB</p>

          <span className="sr-only">File upload</span>
        </label>

        {uploading ? (
          <div className="flex flex-col items-center justify-center space-y-3 border-b border-border/50 p-6 transition-all">
            <p className="text-sm text-muted-foreground">Uploading file...</p>

            <Progress
              className="w-full"
              color="accent"
              value={uploadProgress}
            />
          </div>
        ) : null}

        {uploadedFiles.length > 0 ? (
          <div className="flex min-w-0 flex-col bg-input">
            {uploadedFiles.map((file, k) =>
              showPreview ? (
                <div className="relative z-50" key={`${file.url}-${k}`}>
                  <Button
                    className="absolute right-1 top-1 size-7 rounded-full"
                    onClick={() => {
                      const newUploadedFiles = [...uploadedFiles];
                      newUploadedFiles.splice(k, 1);
                      setUploadedFiles(newUploadedFiles);
                    }}
                    size="icon"
                    type="button"
                    variant="secondary"
                  >
                    <XIcon className="size-5" />
                  </Button>

                  <img
                    alt={`Uploaded file preview: ${file.name || 'file'}`}
                    className="size-full rounded-md object-cover"
                    src={file.url}
                  />
                </div>
              ) : (
                <div
                  className="flex w-full items-center gap-3 overflow-hidden rounded-lg bg-input p-3"
                  key={`${file.url}-${k}`}
                >
                  <FileUser className="size-5 shrink-0 text-muted-foreground" />

                  <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {getDisplayFileName(file.name)}
                  </p>

                  <Button
                    className="size-5 shrink-0 rounded-full"
                    onClick={() => {
                      const newUploadedFiles = [...uploadedFiles];
                      newUploadedFiles.splice(k, 1);
                      setUploadedFiles(newUploadedFiles);
                    }}
                    size="icon"
                    type="button"
                    variant="secondary"
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                </div>
              ),
            )}
          </div>
        ) : null}

        <div className="mt-1 hidden rounded-md shadow-sm">
          <input
            accept={contentTypes}
            className="sr-only"
            id="file-upload"
            multiple
            onChange={onFileChange}
            type="file"
          />

          <select
            className="sr-only"
            defaultValue={multiple ? (urls ?? []) : (urls[0] ?? undefined)}
            multiple={multiple}
            ref={ref}
            {...props}
          >
            {multiple ? (
              urls.map((item, k) => (
                <option key={item} value={item}>
                  {item.substring(0, 5)}...
                </option>
              ))
            ) : (
              <option value={urls[0]}>{urls[0]}...</option>
            )}
          </select>
        </div>
      </div>
    );
  },
);
FileUploadInput.displayName = 'FileUploadInput';

export { FileUploadInput };
