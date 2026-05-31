'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';

import { UpgradeContent } from '@/components/subscription/upgrade-content';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal';

const CLOSE_ANIMATION_DURATION = 250;

export default function UpgradeModalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const feature = searchParams.get('feature') ?? undefined;

  const [isOpen, setIsOpen] = useState(true);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => {
      router.back();
    }, CLOSE_ANIMATION_DURATION);
  }, [router]);

  return (
    <Modal open={isOpen} onOpenChange={open => !open && handleClose()}>
      <ModalContent className="max-h-[90vh]" size="3xl">
        <ModalHeader>
          <ModalTitle>Upgrade to Pro</ModalTitle>
          <ModalDescription>
            Unlock powerful AI features to supercharge your job search.
          </ModalDescription>
        </ModalHeader>
        <ModalBody>
          <UpgradeContent feature={feature} />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
