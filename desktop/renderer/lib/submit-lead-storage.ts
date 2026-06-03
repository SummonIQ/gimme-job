import type {
  DesktopAiProvider,
  DesktopRandomJobProviderId,
  DesktopRandomJobProviderScope,
  DesktopSubmitLeadRequest,
} from '../desktop-api';

const SAVED_SUBMIT_LEAD_KEY = 'gimme-job.desktop.saved-submit-lead';
const SAVED_SUBMIT_LEAD_LIST_KEY = 'gimme-job.desktop.saved-submit-leads';
const SAVED_RANDOM_FILTERS_KEY = 'gimme-job.desktop.random-job-filters';
const SAVED_RANDOM_SEARCHES_KEY = 'gimme-job.desktop.random-job-searches';
const LEGACY_SAVED_RANDOM_FILTERS_KEY =
  'gimme-job.desktop.random-greenhouse-filters';
const SAVED_AI_PROVIDER_KEY = 'gimme-job.desktop.ai-provider';
const SAVED_MODE_KEY = 'gimme-job.desktop.submit-mode';
const SAVED_EYE_SAVER_KEY = 'gimme-job.desktop.eye-saver';

export interface SavedSubmitLeadDraft {
  readonly applicationUrl: string;
  readonly jobLeadId: string;
  readonly mode: DesktopSubmitLeadRequest['mode'];
  readonly title: string;
}

export interface SavedRandomFilters {
  readonly provider: DesktopRandomJobProviderScope;
  readonly providers: readonly DesktopRandomJobProviderId[];
  /**
   * Runtime ATS providers (e.g. lever, ashby) selected for training.
   * Independent of the scraper-source `providers` field.
   */
  readonly runtimeProviders: readonly string[];
  readonly searchLocation: string;
  readonly searchRemote: boolean;
  readonly searchTitle: string;
}

export interface SavedRandomSearch {
  readonly createdAt: string;
  readonly filters: SavedRandomFilters;
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
}

export const DEFAULT_RANDOM_FILTERS: SavedRandomFilters = {
  provider: 'greenhouse',
  providers: ['greenhouse-boards'],
  runtimeProviders: [
    'greenhouse',
    'lever',
    'ashby',
    'smartrecruiters',
    'workable',
  ],
  searchLocation: '',
  searchRemote: false,
  searchTitle: '',
};

export function readSavedSubmitLeadDrafts(): readonly SavedSubmitLeadDraft[] {
  const storage = getBrowserStorage();
  if (!storage) return [];

  const drafts: SavedSubmitLeadDraft[] = [];
  const rawList = storage.getItem(SAVED_SUBMIT_LEAD_LIST_KEY);
  if (rawList) {
    try {
      const parsed = JSON.parse(rawList);
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          const draft = parseDraft(entry);
          if (draft) drafts.push(draft);
        }
      }
    } catch {
      storage.removeItem(SAVED_SUBMIT_LEAD_LIST_KEY);
    }
  }

  const rawLegacy = storage.getItem(SAVED_SUBMIT_LEAD_KEY);
  if (rawLegacy) {
    try {
      const legacyDraft = parseDraft(JSON.parse(rawLegacy));
      if (
        legacyDraft &&
        !drafts.some(d => d.applicationUrl === legacyDraft.applicationUrl)
      ) {
        drafts.push(legacyDraft);
        storage.setItem(SAVED_SUBMIT_LEAD_LIST_KEY, JSON.stringify(drafts));
      }
    } catch {
      /* ignore */
    }
    storage.removeItem(SAVED_SUBMIT_LEAD_KEY);
  }

  return drafts;
}

export function writeSavedSubmitLeadDrafts(
  drafts: readonly SavedSubmitLeadDraft[],
) {
  const storage = getBrowserStorage();
  if (!storage) return;
  storage.setItem(SAVED_SUBMIT_LEAD_LIST_KEY, JSON.stringify(drafts));
}

export function upsertSavedSubmitLeadDraft(
  drafts: readonly SavedSubmitLeadDraft[],
  next: SavedSubmitLeadDraft,
): SavedSubmitLeadDraft[] {
  const filtered = drafts.filter(
    draft => draft.applicationUrl !== next.applicationUrl,
  );
  return [next, ...filtered];
}

export function readSavedRandomSearches(): readonly SavedRandomSearch[] {
  const storage = getBrowserStorage();
  if (!storage) return [];

  const rawList = storage.getItem(SAVED_RANDOM_SEARCHES_KEY);
  if (!rawList) return [];

  try {
    const parsed = JSON.parse(rawList);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(parseRandomSearch)
      .filter((search): search is SavedRandomSearch => Boolean(search));
  } catch {
    storage.removeItem(SAVED_RANDOM_SEARCHES_KEY);
    return [];
  }
}

export function writeSavedRandomSearches(
  searches: readonly SavedRandomSearch[],
) {
  const storage = getBrowserStorage();
  if (!storage) return;
  storage.setItem(SAVED_RANDOM_SEARCHES_KEY, JSON.stringify(searches));
}

export function upsertSavedRandomSearch(
  searches: readonly SavedRandomSearch[],
  next: SavedRandomSearch,
): SavedRandomSearch[] {
  const nextKey = createRandomSearchKey(next.filters);
  const filtered = searches.filter(
    search =>
      search.id !== next.id &&
      createRandomSearchKey(search.filters) !== nextKey,
  );
  return [next, ...filtered].slice(0, 24);
}

export function readSavedRandomFilters(): SavedRandomFilters {
  const storage = getBrowserStorage();
  if (!storage) return DEFAULT_RANDOM_FILTERS;

  const rawFilters =
    storage.getItem(SAVED_RANDOM_FILTERS_KEY) ??
    storage.getItem(LEGACY_SAVED_RANDOM_FILTERS_KEY);
  if (!rawFilters) return DEFAULT_RANDOM_FILTERS;

  try {
    const parsed =
      parseRandomFilters(JSON.parse(rawFilters)) ?? DEFAULT_RANDOM_FILTERS;
    storage.setItem(SAVED_RANDOM_FILTERS_KEY, JSON.stringify(parsed));
    storage.removeItem(LEGACY_SAVED_RANDOM_FILTERS_KEY);
    return parsed;
  } catch {
    storage.removeItem(SAVED_RANDOM_FILTERS_KEY);
    storage.removeItem(LEGACY_SAVED_RANDOM_FILTERS_KEY);
    return DEFAULT_RANDOM_FILTERS;
  }
}

export function createRandomSearchKey(filters: SavedRandomFilters) {
  return JSON.stringify({
    location: filters.searchLocation.trim(),
    provider: filters.provider,
    providers: [...filters.providers].sort(),
    remote: filters.searchRemote,
    title: filters.searchTitle.trim(),
  });
}

export function writeSavedRandomFilters(filters: SavedRandomFilters) {
  const storage = getBrowserStorage();
  if (storage) {
    storage.setItem(SAVED_RANDOM_FILTERS_KEY, JSON.stringify(filters));
  }
  if (typeof window !== 'undefined') {
    void window.gimmeJobDesktop?.settings
      ?.set(SAVED_RANDOM_FILTERS_KEY, filters)
      .catch(() => undefined);
  }
}

export async function loadSavedRandomFilters(): Promise<SavedRandomFilters> {
  if (typeof window === 'undefined') return DEFAULT_RANDOM_FILTERS;

  // Prefer the main-process file store (durable across launches in Electron).
  const settingsApi = window.gimmeJobDesktop?.settings;
  if (settingsApi) {
    try {
      const value = await settingsApi.get(SAVED_RANDOM_FILTERS_KEY);
      const parsed = parseRandomFilters(value);
      if (parsed) {
        // Mirror to localStorage so the synchronous reader stays in sync.
        const storage = getBrowserStorage();
        storage?.setItem(SAVED_RANDOM_FILTERS_KEY, JSON.stringify(parsed));
        return parsed;
      }
    } catch {
      // fall through to localStorage
    }
  }

  return readSavedRandomFilters();
}

export function readSavedAiProvider(): DesktopAiProvider {
  const storage = getBrowserStorage();
  if (!storage) return 'openai';
  const raw = storage.getItem(SAVED_AI_PROVIDER_KEY);
  return raw === 'ollama' || raw === 'openai' ? raw : 'openai';
}

export async function loadSavedAiProvider(): Promise<DesktopAiProvider> {
  if (typeof window === 'undefined') return 'openai';
  const settingsApi = window.gimmeJobDesktop?.settings;
  if (settingsApi) {
    try {
      const value = await settingsApi.get(SAVED_AI_PROVIDER_KEY);
      if (value === 'ollama' || value === 'openai') {
        const storage = getBrowserStorage();
        storage?.setItem(SAVED_AI_PROVIDER_KEY, value);
        return value;
      }
    } catch {
      // fall through to localStorage
    }
  }
  return readSavedAiProvider();
}

export function writeSavedAiProvider(provider: DesktopAiProvider) {
  const storage = getBrowserStorage();
  if (storage) storage.setItem(SAVED_AI_PROVIDER_KEY, provider);
  if (typeof window !== 'undefined') {
    void window.gimmeJobDesktop?.settings
      ?.set(SAVED_AI_PROVIDER_KEY, provider)
      .catch(() => undefined);
  }
}

export type DesktopUiMode = 'training' | 'submit';

export function readSavedMode(): DesktopUiMode {
  const storage = getBrowserStorage();
  if (!storage) return 'training';
  const raw = storage.getItem(SAVED_MODE_KEY);
  if (raw === 'autopilot') return 'submit';
  return raw === 'submit' || raw === 'training' ? raw : 'training';
}

export async function loadSavedMode(): Promise<DesktopUiMode> {
  if (typeof window === 'undefined') return 'training';
  const settingsApi = window.gimmeJobDesktop?.settings;
  if (settingsApi) {
    try {
      const value = await settingsApi.get(SAVED_MODE_KEY);
      if (value === 'submit' || value === 'training' || value === 'autopilot') {
        const mode = value === 'autopilot' ? 'submit' : value;
        const storage = getBrowserStorage();
        storage?.setItem(SAVED_MODE_KEY, mode);
        return mode;
      }
    } catch {
      // fall through to localStorage
    }
  }
  return readSavedMode();
}

export function writeSavedMode(mode: DesktopUiMode) {
  const storage = getBrowserStorage();
  if (storage) storage.setItem(SAVED_MODE_KEY, mode);
  if (typeof window !== 'undefined') {
    void window.gimmeJobDesktop?.settings
      ?.set(SAVED_MODE_KEY, mode)
      .catch(() => undefined);
  }
}

const EYE_SAVER_DEFAULT = true;

export function readSavedEyeSaverMode(): boolean {
  const storage = getBrowserStorage();
  if (!storage) return EYE_SAVER_DEFAULT;
  const raw = storage.getItem(SAVED_EYE_SAVER_KEY);
  if (raw === 'on') return true;
  if (raw === 'off') return false;
  return EYE_SAVER_DEFAULT;
}

export async function loadSavedEyeSaverMode(): Promise<boolean> {
  if (typeof window === 'undefined') return EYE_SAVER_DEFAULT;
  const settingsApi = window.gimmeJobDesktop?.settings;
  if (settingsApi) {
    try {
      const value = await settingsApi.get(SAVED_EYE_SAVER_KEY);
      if (value === 'on' || value === 'off') {
        const storage = getBrowserStorage();
        storage?.setItem(SAVED_EYE_SAVER_KEY, value);
        return value === 'on';
      }
    } catch {
      // fall through to localStorage
    }
  }
  return readSavedEyeSaverMode();
}

export function writeSavedEyeSaverMode(enabled: boolean) {
  const value = enabled ? 'on' : 'off';
  const storage = getBrowserStorage();
  if (storage) storage.setItem(SAVED_EYE_SAVER_KEY, value);
  if (typeof window !== 'undefined') {
    void window.gimmeJobDesktop?.settings
      ?.set(SAVED_EYE_SAVER_KEY, value)
      .catch(() => undefined);
  }
}

export function createLeadKey(applicationUrl: string, jobLeadId: string) {
  return `${applicationUrl.trim()}::${jobLeadId.trim()}`;
}

function parseDraft(value: unknown): SavedSubmitLeadDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<SavedSubmitLeadDraft>;
  if (
    typeof candidate.applicationUrl !== 'string' ||
    typeof candidate.jobLeadId !== 'string' ||
    (candidate.mode !== 'training' && candidate.mode !== 'submit')
  ) {
    return null;
  }
  return {
    applicationUrl: candidate.applicationUrl,
    jobLeadId: candidate.jobLeadId,
    mode: candidate.mode,
    title: typeof candidate.title === 'string' ? candidate.title : '',
  };
}

function parseRandomFilters(value: unknown): SavedRandomFilters | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<SavedRandomFilters>;
  const provider =
    candidate.provider === 'any' || candidate.provider === 'greenhouse'
      ? candidate.provider
      : 'greenhouse';
  const providers = Array.isArray(candidate.providers)
    ? candidate.providers
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean)
    : provider === 'greenhouse'
      ? ['greenhouse-boards']
      : [];
  const runtimeProviders = Array.isArray(candidate.runtimeProviders)
    ? candidate.runtimeProviders
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim().toLowerCase())
        .filter(Boolean)
    : DEFAULT_RANDOM_FILTERS.runtimeProviders;
  return {
    provider,
    providers,
    runtimeProviders,
    searchLocation:
      typeof candidate.searchLocation === 'string'
        ? candidate.searchLocation
        : '',
    searchRemote: candidate.searchRemote === true,
    searchTitle:
      typeof candidate.searchTitle === 'string' ? candidate.searchTitle : '',
  };
}

function parseRandomSearch(value: unknown): SavedRandomSearch | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<SavedRandomSearch>;
  const filters = parseRandomFilters(candidate.filters);
  if (!filters || typeof candidate.id !== 'string') return null;
  const now = new Date().toISOString();
  return {
    createdAt:
      typeof candidate.createdAt === 'string' ? candidate.createdAt : now,
    filters,
    id: candidate.id,
    name:
      typeof candidate.name === 'string' && candidate.name.trim()
        ? candidate.name
        : 'Untitled search',
    updatedAt:
      typeof candidate.updatedAt === 'string' ? candidate.updatedAt : now,
  };
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  const storage = window.localStorage;
  if (
    !storage ||
    typeof storage.getItem !== 'function' ||
    typeof storage.setItem !== 'function' ||
    typeof storage.removeItem !== 'function'
  ) {
    return null;
  }
  return storage;
}
