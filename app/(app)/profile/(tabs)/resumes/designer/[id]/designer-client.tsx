'use client';

import {
  CheckCircle2,
  CircleDot,
  Loader2,
  MessageCircle,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/css';
import { saveStructuredResume } from '@/lib/resumes/structured/actions';
import {
  STRUCTURED_RESUME_SECTIONS,
  type StructuredResume,
  type StructuredResumeSectionId,
} from '@/lib/resumes/structured/schema';

interface DesignerClientProps {
  resumeId: string;
  initialName: string;
  initialData: StructuredResume;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ResumeDesignerClient({
  resumeId,
  initialName,
  initialData,
}: DesignerClientProps) {
  const [data, setData] = useState<StructuredResume>(initialData);
  const [name, setName] = useState<string>(initialName);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [activeSection, setActiveSection] =
    useState<StructuredResumeSectionId>('contact');

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef(data);
  const nameRef = useRef(name);
  dataRef.current = data;
  nameRef.current = name;

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    saveTimerRef.current = setTimeout(async () => {
      try {
        await saveStructuredResume({
          resumeId,
          data: dataRef.current,
          name: nameRef.current,
        });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    }, 700);
  }, [resumeId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Section completion tracker — used in the nav rail.
  const sectionCompletion = useMemo<
    Record<StructuredResumeSectionId, boolean>
  >(
    () => ({
      contact: Boolean(data.contact.fullName && data.contact.email),
      summary: Boolean(data.summary.body && data.summary.body.length > 20),
      experiences: data.experiences.length > 0,
      education: data.education.length > 0,
      skills: data.skills.items.length > 0,
      projects: data.projects.length > 0,
      certifications: data.certifications.length > 0,
    }),
    [data],
  );

  // Scroll-spy: which section is at the top of the viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length === 0) return;
        const top = visible.sort(
          (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
        )[0];
        const id = top.target.getAttribute('data-section-id');
        if (id) setActiveSection(id as StructuredResumeSectionId);
      },
      { rootMargin: '-30% 0px -55% 0px' },
    );
    for (const section of STRUCTURED_RESUME_SECTIONS) {
      const el = document.getElementById(`section-${section.id}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const jumpTo = (id: StructuredResumeSectionId) => {
    const el = document.getElementById(`section-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  };

  const updateData = (next: StructuredResume) => {
    setData(next);
    scheduleSave();
  };

  const updateName = (next: string) => {
    setName(next);
    scheduleSave();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)_360px]">
      {/* Left rail */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <nav aria-label="Resume sections" className="space-y-1">
          {STRUCTURED_RESUME_SECTIONS.map(section => {
            const isActive = activeSection === section.id;
            const isComplete = sectionCompletion[section.id];
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => jumpTo(section.id)}
                className={cn(
                  'group flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                {isComplete ? (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : (
                  <CircleDot
                    className={cn(
                      'size-4',
                      isActive ? 'text-foreground' : 'text-muted-foreground/60',
                    )}
                  />
                )}
                <span className="truncate">{section.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="mt-4 flex items-center gap-2 px-2.5 text-xs text-muted-foreground">
          <SaveIndicator status={saveStatus} />
        </div>
      </aside>

      {/* Center: vertical sections */}
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <Label htmlFor="resume-name">Resume name</Label>
            <Input
              id="resume-name"
              value={name}
              onChange={e => updateName(e.target.value)}
              className="mt-1.5"
              placeholder="e.g. Senior Frontend — May 2026"
            />
          </CardContent>
        </Card>

        <ContactSection
          id="section-contact"
          value={data.contact}
          onChange={contact => updateData({ ...data, contact })}
        />
        <SummarySection
          id="section-summary"
          value={data.summary}
          onChange={summary => updateData({ ...data, summary })}
        />
        <ExperiencesSection
          id="section-experiences"
          value={data.experiences}
          onChange={experiences => updateData({ ...data, experiences })}
        />
        <EducationSection
          id="section-education"
          value={data.education}
          onChange={education => updateData({ ...data, education })}
        />
        <SkillsSection
          id="section-skills"
          value={data.skills}
          onChange={skills => updateData({ ...data, skills })}
        />
        <ProjectsSection
          id="section-projects"
          value={data.projects}
          onChange={projects => updateData({ ...data, projects })}
        />
        <CertificationsSection
          id="section-certifications"
          value={data.certifications}
          onChange={certifications =>
            updateData({ ...data, certifications })
          }
        />
      </div>

      {/* Right: AI chat */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <DesignerChat
          resumeId={resumeId}
          activeSection={activeSection}
          data={data}
          onApplyAnswer={updateData}
        />
      </aside>
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'saving')
    return (
      <>
        <Loader2 className="size-3 animate-spin" /> Saving…
      </>
    );
  if (status === 'saved')
    return (
      <>
        <CheckCircle2 className="size-3 text-emerald-500" /> Saved
      </>
    );
  if (status === 'error')
    return <span className="text-destructive">Save failed</span>;
  return null;
}

function SectionShell({
  id,
  title,
  description,
  dataSectionId,
  children,
}: {
  id: string;
  title: string;
  description: string;
  dataSectionId: StructuredResumeSectionId;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      data-section-id={dataSectionId}
      className="scroll-mt-20"
      aria-labelledby={`${id}-title`}
    >
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <h2 id={`${id}-title`} className="text-lg font-semibold">
              {title}
            </h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </CardContent>
      </Card>
    </section>
  );
}

// ---------- Contact ----------

function ContactSection({
  id,
  value,
  onChange,
}: {
  id: string;
  value: StructuredResume['contact'];
  onChange: (next: StructuredResume['contact']) => void;
}) {
  const setField = <K extends keyof StructuredResume['contact']>(
    key: K,
    next: StructuredResume['contact'][K],
  ) => onChange({ ...value, [key]: next });

  return (
    <SectionShell
      id={id}
      dataSectionId="contact"
      title="Contact"
      description="Name, headline, and how to reach you."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <Input
            value={value.fullName ?? ''}
            onChange={e => setField('fullName', e.target.value)}
            placeholder="Steven Bennett"
          />
        </Field>
        <Field label="Headline">
          <Input
            value={value.headline ?? ''}
            onChange={e => setField('headline', e.target.value)}
            placeholder="Senior Frontend Engineer"
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={value.email ?? ''}
            onChange={e => setField('email', e.target.value)}
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Phone">
          <Input
            value={value.phone ?? ''}
            onChange={e => setField('phone', e.target.value)}
            placeholder="+1 555 555 5555"
          />
        </Field>
        <Field label="Location" className="sm:col-span-2">
          <Input
            value={value.location ?? ''}
            onChange={e => setField('location', e.target.value)}
            placeholder="San Francisco, CA"
          />
        </Field>
      </div>

      <div className="space-y-2">
        <Label>Links</Label>
        {value.links.map((link, idx) => (
          <div className="flex items-center gap-2" key={idx}>
            <Input
              value={link.label}
              onChange={e => {
                const next = value.links.slice();
                next[idx] = { ...next[idx], label: e.target.value };
                onChange({ ...value, links: next });
              }}
              placeholder="Label (e.g. GitHub)"
              className="max-w-[200px]"
            />
            <Input
              value={link.url}
              onChange={e => {
                const next = value.links.slice();
                next[idx] = { ...next[idx], url: e.target.value };
                onChange({ ...value, links: next });
              }}
              placeholder="https://github.com/yourhandle"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                const next = value.links.slice();
                next.splice(idx, 1);
                onChange({ ...value, links: next });
              }}
              aria-label="Remove link"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange({
              ...value,
              links: [...value.links, { label: '', url: '' }],
            })
          }
        >
          <Plus className="mr-1 size-4" /> Add link
        </Button>
      </div>
    </SectionShell>
  );
}

// ---------- Summary ----------

function SummarySection({
  id,
  value,
  onChange,
}: {
  id: string;
  value: StructuredResume['summary'];
  onChange: (next: StructuredResume['summary']) => void;
}) {
  return (
    <SectionShell
      id={id}
      dataSectionId="summary"
      title="Summary"
      description="A short paragraph that frames who you are."
    >
      <Textarea
        value={value.body ?? ''}
        onChange={e => onChange({ ...value, body: e.target.value })}
        placeholder="Two to four sentences. What you do, what you’re great at, what you’re looking for."
        rows={4}
      />
    </SectionShell>
  );
}

// ---------- Experiences ----------

function ExperiencesSection({
  id,
  value,
  onChange,
}: {
  id: string;
  value: StructuredResume['experiences'];
  onChange: (next: StructuredResume['experiences']) => void;
}) {
  const update = (
    idx: number,
    patch: Partial<StructuredResume['experiences'][number]>,
  ) => {
    const next = value.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  return (
    <SectionShell
      id={id}
      dataSectionId="experiences"
      title="Experience"
      description="Where you worked, what you did."
    >
      {value.map((exp, idx) => (
        <div className="rounded-md border p-4" key={exp.id}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="text-sm font-medium text-muted-foreground">
              Role {idx + 1}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}
              aria-label="Remove role"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Company">
              <Input
                value={exp.company ?? ''}
                onChange={e => update(idx, { company: e.target.value })}
                placeholder="Twilio"
              />
            </Field>
            <Field label="Role">
              <Input
                value={exp.role ?? ''}
                onChange={e => update(idx, { role: e.target.value })}
                placeholder="Senior Frontend Engineer"
              />
            </Field>
            <Field label="Start">
              <Input
                value={exp.startDate ?? ''}
                onChange={e => update(idx, { startDate: e.target.value })}
                placeholder="May 2022"
              />
            </Field>
            <Field label="End">
              <Input
                value={exp.endDate ?? ''}
                onChange={e => update(idx, { endDate: e.target.value })}
                disabled={exp.current}
                placeholder={exp.current ? 'Present' : 'Mar 2024'}
              />
            </Field>
            <Field label="Location" className="sm:col-span-2">
              <Input
                value={exp.location ?? ''}
                onChange={e => update(idx, { location: e.target.value })}
                placeholder="Remote · USA"
              />
            </Field>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              id={`exp-current-${exp.id}`}
              type="checkbox"
              checked={exp.current}
              onChange={e =>
                update(idx, {
                  current: e.target.checked,
                  endDate: e.target.checked ? '' : exp.endDate,
                })
              }
            />
            <label
              htmlFor={`exp-current-${exp.id}`}
              className="text-sm text-muted-foreground"
            >
              I currently work here
            </label>
          </div>
          <div className="mt-3 space-y-2">
            <Field label="What you did">
              <Textarea
                value={exp.description ?? ''}
                onChange={e => update(idx, { description: e.target.value })}
                placeholder="One short paragraph, then add bullets below."
                rows={3}
              />
            </Field>
            <BulletEditor
              bullets={exp.bullets}
              onChange={bullets => update(idx, { bullets })}
              placeholder="Shipped X. Led Y. Reduced Z by N%."
            />
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([
            ...value,
            {
              id: newId(),
              company: '',
              role: '',
              startDate: '',
              endDate: '',
              current: false,
              bullets: [],
            },
          ])
        }
      >
        <Plus className="mr-1 size-4" /> Add role
      </Button>
    </SectionShell>
  );
}

// ---------- Education ----------

function EducationSection({
  id,
  value,
  onChange,
}: {
  id: string;
  value: StructuredResume['education'];
  onChange: (next: StructuredResume['education']) => void;
}) {
  const update = (
    idx: number,
    patch: Partial<StructuredResume['education'][number]>,
  ) => {
    const next = value.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  return (
    <SectionShell
      id={id}
      dataSectionId="education"
      title="Education"
      description="Schools, degrees, and relevant detail."
    >
      {value.map((edu, idx) => (
        <div className="rounded-md border p-4" key={edu.id}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="text-sm font-medium text-muted-foreground">
              Entry {idx + 1}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}
              aria-label="Remove education"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="School">
              <Input
                value={edu.school ?? ''}
                onChange={e => update(idx, { school: e.target.value })}
                placeholder="University of X"
              />
            </Field>
            <Field label="Degree">
              <Input
                value={edu.degree ?? ''}
                onChange={e => update(idx, { degree: e.target.value })}
                placeholder="B.S. Computer Science"
              />
            </Field>
            <Field label="Field">
              <Input
                value={edu.field ?? ''}
                onChange={e => update(idx, { field: e.target.value })}
                placeholder="Computer Science"
              />
            </Field>
            <Field label="Location">
              <Input
                value={edu.location ?? ''}
                onChange={e => update(idx, { location: e.target.value })}
                placeholder="City, State"
              />
            </Field>
            <Field label="Start">
              <Input
                value={edu.startDate ?? ''}
                onChange={e => update(idx, { startDate: e.target.value })}
                placeholder="Aug 2014"
              />
            </Field>
            <Field label="End">
              <Input
                value={edu.endDate ?? ''}
                onChange={e => update(idx, { endDate: e.target.value })}
                placeholder="May 2018"
              />
            </Field>
            <Field label="Details" className="sm:col-span-2">
              <Textarea
                value={edu.details ?? ''}
                onChange={e => update(idx, { details: e.target.value })}
                placeholder="GPA, honors, relevant coursework"
                rows={2}
              />
            </Field>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([
            ...value,
            {
              id: newId(),
            },
          ])
        }
      >
        <Plus className="mr-1 size-4" /> Add education
      </Button>
    </SectionShell>
  );
}

// ---------- Skills ----------

function SkillsSection({
  id,
  value,
  onChange,
}: {
  id: string;
  value: StructuredResume['skills'];
  onChange: (next: StructuredResume['skills']) => void;
}) {
  const [draft, setDraft] = useState<string>('');
  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    onChange({ ...value, items: [...value.items, v] });
    setDraft('');
  };
  return (
    <SectionShell
      id={id}
      dataSectionId="skills"
      title="Skills"
      description="Tools, languages, and methods you use."
    >
      <div className="flex flex-wrap gap-2">
        {value.items.map((skill, idx) => (
          <Badge variant="secondary" key={`${skill}-${idx}`}>
            {skill}
            <button
              type="button"
              className="ml-1 text-muted-foreground hover:text-foreground"
              onClick={() =>
                onChange({
                  ...value,
                  items: value.items.filter((_, i) => i !== idx),
                })
              }
              aria-label={`Remove ${skill}`}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          placeholder="Type a skill and press Enter"
        />
        <Button type="button" variant="outline" size="sm" onClick={commit}>
          Add
        </Button>
      </div>
    </SectionShell>
  );
}

// ---------- Projects ----------

function ProjectsSection({
  id,
  value,
  onChange,
}: {
  id: string;
  value: StructuredResume['projects'];
  onChange: (next: StructuredResume['projects']) => void;
}) {
  const update = (
    idx: number,
    patch: Partial<StructuredResume['projects'][number]>,
  ) => {
    const next = value.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  return (
    <SectionShell
      id={id}
      dataSectionId="projects"
      title="Projects"
      description="Side projects or notable work you led."
    >
      {value.map((proj, idx) => (
        <div className="rounded-md border p-4" key={proj.id}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="text-sm font-medium text-muted-foreground">
              Project {idx + 1}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}
              aria-label="Remove project"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input
                value={proj.name ?? ''}
                onChange={e => update(idx, { name: e.target.value })}
                placeholder="Project name"
              />
            </Field>
            <Field label="URL">
              <Input
                value={proj.url ?? ''}
                onChange={e => update(idx, { url: e.target.value })}
                placeholder="https://..."
              />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Textarea
                value={proj.description ?? ''}
                onChange={e => update(idx, { description: e.target.value })}
                placeholder="What it was, what you did, what shipped."
                rows={2}
              />
            </Field>
          </div>
          <div className="mt-3">
            <BulletEditor
              bullets={proj.bullets}
              onChange={bullets => update(idx, { bullets })}
              placeholder="Add a highlight bullet"
            />
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([...value, { id: newId(), bullets: [] }])
        }
      >
        <Plus className="mr-1 size-4" /> Add project
      </Button>
    </SectionShell>
  );
}

// ---------- Certifications ----------

function CertificationsSection({
  id,
  value,
  onChange,
}: {
  id: string;
  value: StructuredResume['certifications'];
  onChange: (next: StructuredResume['certifications']) => void;
}) {
  const update = (
    idx: number,
    patch: Partial<StructuredResume['certifications'][number]>,
  ) => {
    const next = value.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  return (
    <SectionShell
      id={id}
      dataSectionId="certifications"
      title="Certifications"
      description="Credentials worth listing."
    >
      {value.map((c, idx) => (
        <div className="rounded-md border p-4" key={c.id}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="text-sm font-medium text-muted-foreground">
              Cert {idx + 1}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}
              aria-label="Remove certification"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input
                value={c.name ?? ''}
                onChange={e => update(idx, { name: e.target.value })}
              />
            </Field>
            <Field label="Issuer">
              <Input
                value={c.issuer ?? ''}
                onChange={e => update(idx, { issuer: e.target.value })}
              />
            </Field>
            <Field label="Issued">
              <Input
                value={c.issueDate ?? ''}
                onChange={e => update(idx, { issueDate: e.target.value })}
              />
            </Field>
            <Field label="Expires">
              <Input
                value={c.expirationDate ?? ''}
                onChange={e =>
                  update(idx, { expirationDate: e.target.value })
                }
              />
            </Field>
            <Field label="Credential URL" className="sm:col-span-2">
              <Input
                value={c.credentialUrl ?? ''}
                onChange={e =>
                  update(idx, { credentialUrl: e.target.value })
                }
              />
            </Field>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...value, { id: newId() }])}
      >
        <Plus className="mr-1 size-4" /> Add certification
      </Button>
    </SectionShell>
  );
}

// ---------- Field shell ----------

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

// ---------- Bullet editor ----------

function BulletEditor({
  bullets,
  onChange,
  placeholder,
}: {
  bullets: readonly string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>Bullets</Label>
      {bullets.map((b, i) => (
        <div className="flex items-start gap-2" key={i}>
          <Textarea
            value={b}
            rows={2}
            onChange={e => {
              const next = bullets.slice();
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={placeholder}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(bullets.filter((_, k) => k !== i))}
            aria-label="Remove bullet"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...bullets, ''])}
      >
        <Plus className="mr-1 size-4" /> Add bullet
      </Button>
    </div>
  );
}

// ---------- Designer chat ----------

interface GuidedQuestion {
  id: string;
  prompt: string;
  // Where the answer should land in `data`.
  apply: (answer: string, data: StructuredResume) => StructuredResume;
}

function getGuidedQuestions(
  section: StructuredResumeSectionId,
  data: StructuredResume,
): GuidedQuestion[] {
  switch (section) {
    case 'contact':
      return [
        {
          id: 'name',
          prompt: 'What is your full name?',
          apply: (a, d) => ({ ...d, contact: { ...d.contact, fullName: a } }),
        },
        {
          id: 'headline',
          prompt: 'What headline do you want at the top of your resume?',
          apply: (a, d) => ({ ...d, contact: { ...d.contact, headline: a } }),
        },
        {
          id: 'email',
          prompt: 'What is the best email to reach you at?',
          apply: (a, d) => ({ ...d, contact: { ...d.contact, email: a } }),
        },
        {
          id: 'location',
          prompt: 'Where are you based?',
          apply: (a, d) => ({ ...d, contact: { ...d.contact, location: a } }),
        },
      ];
    case 'summary':
      return [
        {
          id: 'summary',
          prompt:
            'In a sentence or two, what kind of work are you looking for and what are you great at?',
          apply: (a, d) => ({ ...d, summary: { body: a } }),
        },
      ];
    case 'experiences': {
      const last = data.experiences[data.experiences.length - 1];
      if (!last || (last.company && last.role && last.startDate)) {
        return [
          {
            id: 'company',
            prompt: 'Where did you work? (company name)',
            apply: (a, d) => ({
              ...d,
              experiences: [
                ...d.experiences,
                {
                  id: newId(),
                  company: a,
                  role: '',
                  startDate: '',
                  endDate: '',
                  current: false,
                  bullets: [],
                },
              ],
            }),
          },
        ];
      }
      const idx = data.experiences.length - 1;
      const patch = (
        p: Partial<StructuredResume['experiences'][number]>,
      ) => (a: string, d: StructuredResume) => {
        const next = d.experiences.slice();
        next[idx] = { ...next[idx], ...p, ...(typeof p === 'function' ? {} : {}) };
        // overwrite with the actual string in the patched key
        const key = Object.keys(p)[0] as keyof typeof next[number];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (next[idx] as any)[key] = a;
        return { ...d, experiences: next };
      };
      if (!last.role)
        return [
          {
            id: 'role',
            prompt: `What was your role at ${last.company}?`,
            apply: patch({ role: '' }),
          },
        ];
      if (!last.startDate)
        return [
          {
            id: 'startDate',
            prompt: `When did you start at ${last.company}?`,
            apply: patch({ startDate: '' }),
          },
        ];
      if (!last.endDate && !last.current)
        return [
          {
            id: 'endDate',
            prompt: `When did you leave ${last.company}? (or say "still there")`,
            apply: (a, d) => {
              const next = d.experiences.slice();
              const isCurrent = /still|current|present/i.test(a);
              next[idx] = {
                ...next[idx],
                current: isCurrent,
                endDate: isCurrent ? '' : a,
              };
              return { ...d, experiences: next };
            },
          },
        ];
      if (!last.description)
        return [
          {
            id: 'description',
            prompt: `In a sentence, what did you do at ${last.company}?`,
            apply: patch({ description: '' }),
          },
        ];
      return [
        {
          id: 'nextCompany',
          prompt: 'Add another role? (type the company name, or skip)',
          apply: (a, d) => {
            if (/^(skip|no|done|that.?s it)$/i.test(a.trim())) return d;
            return {
              ...d,
              experiences: [
                ...d.experiences,
                {
                  id: newId(),
                  company: a,
                  role: '',
                  startDate: '',
                  endDate: '',
                  current: false,
                  bullets: [],
                },
              ],
            };
          },
        },
      ];
    }
    case 'education':
      return [
        {
          id: 'school',
          prompt: 'Where did you go to school?',
          apply: (a, d) => ({
            ...d,
            education: [...d.education, { id: newId(), school: a }],
          }),
        },
      ];
    case 'skills':
      return [
        {
          id: 'skills',
          prompt:
            'List your strongest skills, comma-separated (e.g. TypeScript, React, Postgres).',
          apply: (a, d) => ({
            ...d,
            skills: {
              items: a
                .split(',')
                .map(s => s.trim())
                .filter(Boolean),
            },
          }),
        },
      ];
    case 'projects':
      return [
        {
          id: 'project',
          prompt: 'What is a project worth showing?',
          apply: (a, d) => ({
            ...d,
            projects: [
              ...d.projects,
              { id: newId(), name: a, bullets: [] },
            ],
          }),
        },
      ];
    case 'certifications':
      return [
        {
          id: 'cert',
          prompt: 'What certification do you have? (or "skip")',
          apply: (a, d) => {
            if (/^skip$/i.test(a.trim())) return d;
            return {
              ...d,
              certifications: [...d.certifications, { id: newId(), name: a }],
            };
          },
        },
      ];
  }
}

function DesignerChat({
  resumeId,
  activeSection,
  data,
  onApplyAnswer,
}: {
  resumeId: string;
  activeSection: StructuredResumeSectionId;
  data: StructuredResume;
  onApplyAnswer: (next: StructuredResume) => void;
}) {
  const [mode, setMode] = useState<'guided' | 'chat'>('guided');

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-amber-400" />
            Resume assistant
          </div>
          <div className="flex items-center rounded-md border bg-muted/30 p-0.5 text-xs">
            <button
              type="button"
              className={cn(
                'rounded px-2 py-1',
                mode === 'guided' ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
              onClick={() => setMode('guided')}
            >
              Guided
            </button>
            <button
              type="button"
              className={cn(
                'rounded px-2 py-1',
                mode === 'chat' ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
              onClick={() => setMode('chat')}
            >
              <MessageCircle className="mr-1 inline size-3" /> Chat
            </button>
          </div>
        </div>
        {mode === 'guided' ? (
          <GuidedChat
            activeSection={activeSection}
            data={data}
            onApplyAnswer={onApplyAnswer}
          />
        ) : (
          <OpenChat resumeId={resumeId} activeSection={activeSection} />
        )}
      </CardContent>
    </Card>
  );
}

function GuidedChat({
  activeSection,
  data,
  onApplyAnswer,
}: {
  activeSection: StructuredResumeSectionId;
  data: StructuredResume;
  onApplyAnswer: (next: StructuredResume) => void;
}) {
  const [answer, setAnswer] = useState('');
  const questions = getGuidedQuestions(activeSection, data);
  const current = questions[0];

  if (!current) {
    return (
      <p className="text-sm text-muted-foreground">
        This section looks complete. Jump to the next one when you’re ready.
      </p>
    );
  }

  const submit = () => {
    const v = answer.trim();
    if (!v) return;
    onApplyAnswer(current.apply(v, data));
    setAnswer('');
  };

  return (
    <div className="space-y-2">
      <p className="text-sm">{current.prompt}</p>
      <Textarea
        value={answer}
        onChange={e => setAnswer(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        rows={2}
        placeholder="Type your answer…"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">⌘ Enter to send</span>
        <Button size="sm" onClick={submit} disabled={!answer.trim()}>
          Answer
        </Button>
      </div>
    </div>
  );
}

function OpenChat({
  resumeId,
  activeSection,
}: {
  resumeId: string;
  activeSection: StructuredResumeSectionId;
}) {
  const [messages, setMessages] = useState<
    { id: string; role: 'user' | 'assistant'; text: string }[]
  >([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    const v = draft.trim();
    if (!v || sending) return;
    const userMsg = { id: newId(), role: 'user' as const, text: v };
    setMessages(prev => [...prev, userMsg]);
    setDraft('');
    setSending(true);
    try {
      const res = await fetch(`/api/resumes/${resumeId}/designer-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeSection,
          messages: [...messages, userMsg].map(m => ({
            role: m.role,
            content: m.text,
          })),
        }),
      });
      const body = (await res.json()) as { text?: string; error?: string };
      setMessages(prev => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          text: body.text ?? body.error ?? '…',
        },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          text: 'Sorry — that request failed.',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="max-h-64 space-y-2 overflow-y-auto pr-1 text-sm">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ask anything about your resume — describe a job, paste an old
            bullet, or ask for rewrites.
          </p>
        ) : (
          messages.map(m => (
            <div
              key={m.id}
              className={cn(
                'rounded-md px-3 py-2',
                m.role === 'user' ? 'bg-muted/50' : 'bg-accent/40',
              )}
            >
              <div className="text-xs font-medium text-muted-foreground">
                {m.role === 'user' ? 'You' : 'Assistant'}
              </div>
              <div className="whitespace-pre-wrap">{m.text}</div>
            </div>
          ))
        )}
      </div>
      <Textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
          }
        }}
        rows={2}
        placeholder="Ask about your resume…"
        disabled={sending}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">⌘ Enter to send</span>
        <Button size="sm" onClick={send} disabled={!draft.trim() || sending}>
          {sending ? <Loader2 className="size-3 animate-spin" /> : 'Send'}
        </Button>
      </div>
    </div>
  );
}
