'use client';

import { ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Report } from '@/components/data/report';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { formatRelativeTime } from '@/lib/time';
import type { ReportColumn } from '@/types/reporting/report';

interface UserKnowledgeEntry {
  confidence: number;
  createdAt: string;
  id: string;
  key: string;
  source: string;
  updatedAt: string;
  value: string;
}

const RELATIVE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

const ABSOLUTE_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const FULL_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  month: 'long',
  year: 'numeric',
});

const MODAL_CLOSE_ANIMATION_MS = 220;

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const ageMs = Date.now() - date.getTime();
  if (ageMs < RELATIVE_THRESHOLD_MS) {
    return formatRelativeTime(date);
  }
  return ABSOLUTE_DATE_FORMAT.format(date);
}

function tryParseJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const first = trimmed[0];
  if (first !== '{' && first !== '[') return undefined;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') return parsed;
    return undefined;
  } catch {
    return undefined;
  }
}

function compactWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function formatKnowledgeKey(raw: string): string {
  const formatted = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .trim();

  if (!formatted) return raw;
  return `${formatted.charAt(0).toUpperCase()}${formatted.slice(1)}`;
}

function formatConfidencePercent(confidence: number): string {
  const normalized = Math.max(0, Math.min(1, confidence));
  return `${Math.round(normalized * 100)}%`;
}

const KnowledgeValuePreview = ({ value }: { readonly value: string }) => {
  const parsed = tryParseJson(value);

  if (parsed !== undefined) {
    const isArray = Array.isArray(parsed);
    const keys = isArray ? [] : Object.keys(parsed as Record<string, unknown>);
    const count = isArray ? parsed.length : keys.length;
    const countLabel = `${count} ${count === 1 ? (isArray ? 'item' : 'key') : isArray ? 'items' : 'keys'}`;

    return (
      <div
        className="flex min-w-0 max-w-full items-center gap-1.5"
        title={value}
      >
        <Badge
          className="h-5 shrink-0 px-1.5 font-mono text-[10px] uppercase"
          variant="outline"
        >
          {isArray ? 'Array' : 'Object'}
        </Badge>
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          {countLabel}
        </span>
        {!isArray && keys.length > 0 ? (
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {keys.slice(0, 4).join(', ')}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <span
      className="block max-w-full truncate rounded-md border border-border/50 bg-muted/40 px-2 py-1 font-mono text-xs text-foreground/85"
      title={value}
    >
      {compactWhitespace(value)}
    </span>
  );
};

KnowledgeValuePreview.displayName = 'KnowledgeValuePreview';

interface JsonNodeProps {
  readonly depth: number;
  readonly label: string | null;
  readonly value: unknown;
}

const JsonNode = ({ depth, label, value }: JsonNodeProps) => {
  const isContainer =
    value !== null && (Array.isArray(value) || typeof value === 'object');
  const [expanded, setExpanded] = useState(depth < 1);

  if (!isContainer) {
    return (
      <div className="flex gap-1.5">
        {label !== null ? (
          <span className="text-muted-foreground">{label}:</span>
        ) : null}
        <JsonPrimitive value={value} />
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries: Array<[string, unknown]> = isArray
    ? (value as unknown[]).map((item, index) => [String(index), item])
    : Object.entries(value as Record<string, unknown>);
  const open = isArray ? '[' : '{';
  const close = isArray ? ']' : '}';

  if (entries.length === 0) {
    return (
      <div className="flex gap-1.5">
        {label !== null ? (
          <span className="text-muted-foreground">{label}:</span>
        ) : null}
        <span>
          {open}
          {close}
        </span>
      </div>
    );
  }

  const summary = isArray
    ? `${entries.length} ${entries.length === 1 ? 'item' : 'items'}`
    : `${entries.length} ${entries.length === 1 ? 'key' : 'keys'}`;

  return (
    <div>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded text-left hover:text-foreground"
        onClick={() => setExpanded(prev => !prev)}
      >
        {expanded ? (
          <ChevronDown className="size-3 shrink-0" />
        ) : (
          <ChevronRight className="size-3 shrink-0" />
        )}
        {label !== null ? (
          <span className="text-muted-foreground">{label}:</span>
        ) : null}
        <span>{open}</span>
        {!expanded ? (
          <span className="text-muted-foreground">
            {summary}
            {close}
          </span>
        ) : null}
      </button>
      {expanded ? (
        <div className="ml-2 border-l border-border/40 pl-3">
          {entries.map(([childKey, childValue]) => (
            <JsonNode
              key={childKey}
              depth={depth + 1}
              label={childKey}
              value={childValue}
            />
          ))}
          <div>{close}</div>
        </div>
      ) : null}
    </div>
  );
};

JsonNode.displayName = 'JsonNode';

const JsonPrimitive = ({ value }: { readonly value: unknown }) => {
  if (value === null) {
    return <span className="text-muted-foreground">null</span>;
  }
  if (value === undefined) {
    return <span className="text-muted-foreground">undefined</span>;
  }
  if (typeof value === 'boolean') {
    return (
      <span className="text-blue-600 dark:text-blue-400">{String(value)}</span>
    );
  }
  if (typeof value === 'number') {
    return <span className="text-amber-600 dark:text-amber-400">{value}</span>;
  }
  if (typeof value === 'string') {
    return (
      <span className="break-all text-emerald-700 dark:text-emerald-400">
        &quot;{value}&quot;
      </span>
    );
  }
  return <span>{String(value)}</span>;
};

JsonPrimitive.displayName = 'JsonPrimitive';

const JsonTree = ({ value }: { readonly value: unknown }) => (
  <div className="font-mono text-xs leading-5">
    <JsonNode depth={0} label={null} value={value} />
  </div>
);

JsonTree.displayName = 'JsonTree';

interface EntryDetailModalProps {
  readonly draftValue: string;
  readonly entry: UserKnowledgeEntry | null;
  readonly isSaving: boolean;
  readonly onClose: () => void;
  readonly onDelete: () => void;
  readonly onDraftChange: (value: string) => void;
  readonly onSave: () => void;
}

const EntryDetailModal = ({
  draftValue,
  entry,
  isSaving,
  onClose,
  onDelete,
  onDraftChange,
  onSave,
}: EntryDetailModalProps) => {
  const parsed = useMemo(() => tryParseJson(draftValue), [draftValue]);
  const [isOpen, setIsOpen] = useState(Boolean(entry));
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (!closeTimeoutRef.current) return;
    clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = null;
  }, []);

  const requestClose = useCallback(() => {
    clearCloseTimer();
    setIsOpen(false);
    closeTimeoutRef.current = setTimeout(() => {
      closeTimeoutRef.current = null;
      onClose();
    }, MODAL_CLOSE_ANIMATION_MS);
  }, [clearCloseTimer, onClose]);

  useEffect(() => {
    if (entry) {
      clearCloseTimer();
      setIsOpen(true);
    }

    return clearCloseTimer;
  }, [clearCloseTimer, entry]);

  if (!entry) return null;

  const updatedFull = FULL_DATE_FORMAT.format(new Date(entry.updatedAt));
  const createdFull = FULL_DATE_FORMAT.format(new Date(entry.createdAt));

  return (
    <Modal
      open={isOpen}
      onOpenChange={open => (open ? setIsOpen(true) : requestClose())}
    >
      <ModalContent className="w-[64rem] max-w-[calc(100vw-2rem)]" size="full">
        <ModalHeader>
          <ModalTitle className="break-all font-mono text-base">
            {entry.key}
          </ModalTitle>
          <ModalDescription>
            View and edit the value stored under this key.
          </ModalDescription>
        </ModalHeader>
        <ModalBody className="gap-5">
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Source</p>
              <Badge className="mt-1" variant="secondary">
                {entry.source}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Confidence</p>
              <Badge className="mt-1 font-mono" variant="outline">
                {formatConfidencePercent(entry.confidence)}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Updated</p>
              <p className="mt-1 text-sm">{updatedFull}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="mt-1 text-sm">{createdFull}</p>
            </div>
          </div>

          {parsed !== undefined ? (
            <Tabs
              key={entry.key}
              defaultValue="json"
              className="flex flex-col gap-3 space-y-0"
            >
              <TabsList>
                <TabsTrigger value="json">JSON</TabsTrigger>
                <TabsTrigger value="raw">Raw</TabsTrigger>
              </TabsList>

              <TabsContent value="json" className="mt-0">
                <div className="max-h-[28rem] overflow-auto rounded-md border border-border/60 bg-muted/40 p-3">
                  <JsonTree value={parsed} />
                </div>
              </TabsContent>

              <TabsContent value="raw" className="mt-0">
                <Textarea
                  className="min-h-[180px] font-mono text-xs"
                  value={draftValue}
                  onChange={event => onDraftChange(event.target.value)}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">Value</p>
              <Textarea
                className="min-h-[180px] font-mono text-xs"
                value={draftValue}
                onChange={event => onDraftChange(event.target.value)}
              />
            </div>
          )}
        </ModalBody>
        <ModalFooter className="!justify-between">
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            disabled={isSaving}
          >
            Delete
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="button" onClick={onSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

EntryDetailModal.displayName = 'EntryDetailModal';

const UserKnowledgeSettingsPage = () => {
  const [entries, setEntries] = useState<UserKnowledgeEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingKey, setIsSavingKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((left, right) => {
      const confidenceDelta = right.confidence - left.confidence;
      if (confidenceDelta !== 0) return confidenceDelta;
      return left.key.localeCompare(right.key);
    });
  }, [entries]);

  const fetchKnowledge = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/user/knowledge', { method: 'GET' });
      if (!response.ok) {
        throw new Error('Failed to load knowledge');
      }
      const data = (await response.json()) as {
        entries?: UserKnowledgeEntry[];
      };
      const nextEntries = data.entries ?? [];
      setEntries(nextEntries);
      setDrafts(
        nextEntries.reduce<Record<string, string>>((acc, entry) => {
          acc[entry.key] = entry.value;
          return acc;
        }, {}),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load user knowledge.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchKnowledge();
  }, [fetchKnowledge]);

  const handleSave = useCallback(
    async (key: string) => {
      const value = drafts[key]?.trim() ?? '';
      if (!value) {
        setError('Value cannot be empty.');
        return;
      }

      setIsSavingKey(key);
      setError(null);
      try {
        const response = await fetch('/api/user/knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, source: 'manual', value }),
        });
        if (!response.ok) {
          throw new Error('Failed to save knowledge value');
        }
        await fetchKnowledge();
        setEditingKey(current => (current === key ? null : current));
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : 'Failed to save user knowledge.',
        );
      } finally {
        setIsSavingKey(null);
      }
    },
    [drafts, fetchKnowledge],
  );

  const handleDelete = useCallback(
    async (key: string) => {
      setIsSavingKey(key);
      setError(null);
      try {
        const response = await fetch(
          `/api/user/knowledge?key=${encodeURIComponent(key)}`,
          {
            method: 'DELETE',
          },
        );
        if (!response.ok) {
          throw new Error('Failed to delete knowledge value');
        }
        await fetchKnowledge();
        setEditingKey(current => (current === key ? null : current));
      } catch (deleteError) {
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : 'Failed to delete user knowledge.',
        );
      } finally {
        setIsSavingKey(null);
      }
    },
    [fetchKnowledge],
  );

  const handleCreate = async () => {
    const key = newKey.trim();
    const value = newValue.trim();
    if (!key || !value) {
      setError('Both key and value are required.');
      return;
    }

    setIsSavingKey('__create__');
    setError(null);
    try {
      const response = await fetch('/api/user/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, source: 'manual', value }),
      });
      if (!response.ok) {
        throw new Error('Failed to create knowledge value');
      }
      setNewKey('');
      setNewValue('');
      await fetchKnowledge();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Failed to create user knowledge.',
      );
    } finally {
      setIsSavingKey(null);
    }
  };

  const columns = useMemo<Array<ReportColumn<UserKnowledgeEntry>>>(
    () => [
      {
        align: 'left',
        cellFn: entry => (
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="min-w-0 truncate text-sm font-medium text-foreground"
                title={formatKnowledgeKey(entry.key)}
              >
                {formatKnowledgeKey(entry.key)}
              </span>
              <Badge
                className="h-5 shrink-0 px-1.5 font-mono text-[10px]"
                title={`${formatConfidencePercent(entry.confidence)} confidence`}
                variant="outline"
              >
                {formatConfidencePercent(entry.confidence)}
              </Badge>
            </div>
            <code
              className="block min-w-0 truncate text-[11px] text-muted-foreground"
              title={entry.key}
            >
              {entry.key}
            </code>
          </div>
        ),
        className: 'w-[288px] max-w-[288px]',
        header: 'Knowledge',
        key: 'key',
        maxWidth: '288px',
        sortable: true,
      },
      {
        align: 'left',
        cellFn: entry => <KnowledgeValuePreview value={entry.value} />,
        className: 'w-[360px] max-w-[360px] px-2',
        header: 'Value',
        key: 'value',
        maxWidth: '360px',
        sortable: true,
      },
      {
        align: 'left',
        cellFn: entry => (
          <Badge
            className="max-w-full truncate px-1.5 py-0 text-[10px]"
            variant="secondary"
          >
            {entry.source}
          </Badge>
        ),
        className: 'w-[84px] max-w-[84px] px-2',
        header: 'Source',
        key: 'source',
        maxWidth: '84px',
        sortable: true,
      },
      {
        align: 'left',
        cellFn: entry => (
          <span
            className="text-xs text-muted-foreground"
            title={FULL_DATE_FORMAT.format(new Date(entry.updatedAt))}
          >
            {formatUpdatedAt(entry.updatedAt)}
          </span>
        ),
        className: 'w-[96px] max-w-[96px] px-2',
        header: 'Updated',
        key: 'updatedAt',
        maxWidth: '96px',
        sortable: true,
      },
      {
        align: 'right',
        cellFn: entry => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="size-8 p-0"
                  variant="ghost"
                  disabled={isSavingKey === entry.key}
                >
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => setEditingKey(entry.key)}>
                  View / edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => handleDelete(entry.key)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
        header: 'Actions',
        hideable: false,
        maxWidth: '80px',
      },
    ],
    [handleDelete, isSavingKey],
  );

  const editingEntry = useMemo(
    () =>
      editingKey
        ? (sortedEntries.find(entry => entry.key === editingKey) ?? null)
        : null,
    [editingKey, sortedEntries],
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Knowledge Memory</h3>
        <p className="text-sm text-muted-foreground">
          Review and edit everything we know about you for applications.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to complete request</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-lg border border-border/60 p-4">
        <h4 className="text-sm font-semibold">Add knowledge</h4>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_2fr_auto]">
          <Input
            placeholder="key (e.g. workAuthorization)"
            value={newKey}
            onChange={event => setNewKey(event.target.value)}
          />
          <Input
            placeholder="value"
            value={newValue}
            onChange={event => setNewValue(event.target.value)}
          />
          <Button
            type="button"
            onClick={handleCreate}
            disabled={isSavingKey === '__create__'}
          >
            {isSavingKey === '__create__' ? 'Saving...' : 'Add'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
          Loading knowledge...
        </p>
      ) : sortedEntries.length === 0 ? (
        <p className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
          No knowledge saved yet.
        </p>
      ) : (
        <Report<UserKnowledgeEntry, never>
          cacheKey="userKnowledge"
          columns={columns}
          initialData={sortedEntries}
          initialQuery={{
            pagination: { count: 25, start: 0 },
          }}
          model="userKnowledge"
          showColumnToggle={false}
          showExport={false}
          showPagination={sortedEntries.length > 25}
          showSearch={false}
          onRowClick={entry => setEditingKey(entry.key)}
        />
      )}

      <EntryDetailModal
        draftValue={editingEntry ? (drafts[editingEntry.key] ?? '') : ''}
        entry={editingEntry}
        isSaving={isSavingKey === editingKey}
        onClose={() => setEditingKey(null)}
        onDelete={() => editingEntry && handleDelete(editingEntry.key)}
        onDraftChange={value =>
          editingEntry
            ? setDrafts(prev => ({ ...prev, [editingEntry.key]: value }))
            : null
        }
        onSave={() => editingEntry && handleSave(editingEntry.key)}
      />
    </div>
  );
};

UserKnowledgeSettingsPage.displayName = 'UserKnowledgeSettingsPage';

export { UserKnowledgeSettingsPage };
