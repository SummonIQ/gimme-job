'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, UserCircle } from 'lucide-react';
import { useState } from 'react';

interface PeopleResearchModalProps {
  trigger?: React.ReactNode;
  onResearchComplete?: () => void;
}

export function PeopleResearchModal({
  trigger,
  onResearchComplete,
}: PeopleResearchModalProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    title: '',
    linkedinUrl: '',
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.company) {
      toast({
        title: 'Missing Information',
        description: 'Please provide at least a name and company.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/people-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to research person');
      }

      const data = await response.json();

      toast({
        title: 'Research Complete',
        description: `Successfully researched ${formData.name}`,
      });

      setOpen(false);
      setFormData({ name: '', company: '', title: '', linkedinUrl: '' });

      if (onResearchComplete) {
        onResearchComplete();
      }
    } catch (error) {
      console.error('Research error:', error);
      toast({
        title: 'Research Failed',
        description: 'Failed to complete research. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        {trigger || (
          <Button size="lg">
            <UserCircle className="mr-2 size-4" />
            Research Person
          </Button>
        )}
      </ModalTrigger>
      <ModalContent className="sm:max-w-[500px]">
        <ModalHeader>
          <ModalTitle>Research a Person</ModalTitle>
          <ModalDescription>
            Enter details about the person you want to research. We'll gather
            professional information, background, and insights.
          </ModalDescription>
        </ModalHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              placeholder="John Smith"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Company *</Label>
            <Input
              id="company"
              placeholder="Acme Corp"
              value={formData.company}
              onChange={e =>
                setFormData({ ...formData, company: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Job Title</Label>
            <Input
              id="title"
              placeholder="Senior Engineer"
              value={formData.title}
              onChange={e =>
                setFormData({ ...formData, title: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
            <Input
              id="linkedinUrl"
              type="url"
              placeholder="https://linkedin.com/in/..."
              value={formData.linkedinUrl}
              onChange={e =>
                setFormData({ ...formData, linkedinUrl: e.target.value })
              }
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Researching...
                </>
              ) : (
                <>
                  <Search className="mr-2 size-4" />
                  Start Research
                </>
              )}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
