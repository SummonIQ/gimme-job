import type { ReactNode } from 'react';

export default function AssistTrainingLayout({
  children,
  trainingSessionModal,
}: {
  children: ReactNode;
  trainingSessionModal: ReactNode;
}) {
  return (
    <>
      {children}
      {trainingSessionModal}
    </>
  );
}
