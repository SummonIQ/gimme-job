import { Loader2 } from 'lucide-react';

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';

export default function JobModalLoading() {
  return (
    <Modal open>
      <ModalContent
        className="p-0 flex flex-col"
        style={{ width: '60vw', height: '90vh', maxWidth: 'none' }}
      >
        <ModalHeader>
          <div className="flex-1 min-w-0 space-y-2">
            <ModalTitle className="text-2xl font-bold leading-tight">
              <Skeleton className="h-8 w-64" />
            </ModalTitle>
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="flex gap-2 mt-4">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        </ModalHeader>

        <ModalBody>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}