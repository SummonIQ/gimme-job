import { HelpCircle, Mail, MessageCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export const metadata: Metadata = {
  title: 'Contact - Gimme Job',
  description: 'Get in touch with the Gimme Job team.',
};

const supportChannels = [
  {
    icon: Mail,
    title: 'Email support',
    description: 'For everything — bugs, questions, billing, feedback.',
    value: 'support@gimmejob.com',
    href: 'mailto:support@gimmejob.com',
  },
  {
    icon: HelpCircle,
    title: 'Help center',
    description: 'Browse guides, tutorials, and common troubleshooting.',
    value: 'Visit help center',
    href: '/help',
  },
  {
    icon: MessageCircle,
    title: 'Community',
    description: 'Ask other users and share tips in our forum.',
    value: 'Join the community',
    href: '/community',
  },
];

export default function ContactPage() {
  return (
    <div className="bg-white pt-32 pb-24 dark:bg-slate-950 sm:pt-40 sm:pb-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center pt-12 sm:pt-16 mb-16">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm text-primary">
            <Mail className="size-3.5" />
            Get in touch
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            We&apos;re here to help
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Questions, feedback, or just want to say hi — we read every
            message and route it to the right place.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]">
          {/* Contact form */}
          <Card className="border-border/60 bg-card">
            <CardHeader>
              <CardTitle className="text-2xl">Send us a message</CardTitle>
              <CardDescription>
                Fill out the form below and include any context that would help
                us understand what you need.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Jane Doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    name="subject"
                    type="text"
                    placeholder="How can we help?"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    name="message"
                    rows={6}
                    placeholder="Tell us what's on your mind…"
                    required
                  />
                </div>

                <Button type="submit" size="lg" className="w-fit">
                  Send message
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Support channels */}
          <div className="space-y-4">
            {supportChannels.map(channel => (
              <Link
                key={channel.title}
                href={channel.href}
                className="block rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <channel.icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {channel.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {channel.description}
                    </p>
                    <p className="mt-2 text-xs font-medium text-primary">
                      {channel.value}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
