import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Cpu,
  Eye,
  Info,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  PencilLine,
  Play,
  Repeat,
  RotateCw,
  Search,
  Send,
  SlidersHorizontal,
  Shuffle,
  SquareArrowOutUpRight,
  Square,
  Star,
  type LucideIcon,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { MANUAL_PROVIDER_OPTIONS } from '@/lib/admin/manual-provider-options';

import type {
  DesktopAiProvider,
  DesktopRandomJobProviderId,
  DesktopRuntimeProviderInfo,
} from '../desktop-api';
import type {
  SavedRandomSearch,
  SavedSubmitLeadDraft,
} from '../lib/submit-lead-storage';

type RunActionMode = 'autofill' | 'submit';

type DesktopAuthStatus = 'unpaired' | 'paired' | 'invalid';

const providerOptions = MANUAL_PROVIDER_OPTIONS;

function getSelectedProviderValues(
  providers: readonly DesktopRandomJobProviderId[],
) {
  return providers.length > 0
    ? providers
    : providerOptions.map(provider => provider.value);
}

function formatSelectedProviders(
  providers: readonly DesktopRandomJobProviderId[],
) {
  const selectedProviders = getSelectedProviderValues(providers);
  if (selectedProviders.length === providerOptions.length) {
    return 'All providers';
  }
  if (selectedProviders.length === 1) {
    return (
      providerOptions.find(provider => provider.value === selectedProviders[0])
        ?.label ?? '1 provider'
    );
  }
  return `${selectedProviders.length} providers`;
}

interface DesktopToolbarProps {
  readonly isSidebarOpen: boolean;
  readonly leftWidthPct: number;
  readonly onToggleSidebar: () => void;
  readonly trailing?: ReactNode;
}

export function DesktopToolbar({
  isSidebarOpen,
  leftWidthPct,
  onToggleSidebar,
  trailing,
}: DesktopToolbarProps) {
  return (
    <header className="desktop-toolbar" role="toolbar" aria-label="Desktop">
      <div
        className="desktop-toolbar-left"
        style={{
          flexBasis: isSidebarOpen ? `${Math.max(leftWidthPct, 0)}%` : 'auto',
          flexShrink: 0,
        }}
      >
        <ToolbarIconButton
          icon={isSidebarOpen ? PanelLeftClose : PanelLeftOpen}
          label={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          onClick={onToggleSidebar}
          pressed={isSidebarOpen}
        />
      </div>

      {trailing ? (
        <div className="desktop-toolbar-trailing">{trailing}</div>
      ) : null}
    </header>
  );
}

export interface DesktopControlPanelProps {
  readonly aiProvider: DesktopAiProvider;
  readonly applicationUrl: string;
  readonly authStatus: DesktopAuthStatus;
  readonly isAutopilotActive?: boolean;
  readonly isAutopilotPaused?: boolean;
  readonly isAutofillPaused?: boolean;
  readonly isAutopilotEnabled?: boolean;
  readonly isPickingRandom: boolean;
  readonly isRunning: boolean;
  readonly mode: 'training' | 'submit';
  readonly onAiProviderChange: (provider: DesktopAiProvider) => void;
  readonly onCancelRun: () => void;
  readonly onLoadSavedSearch: (search: SavedRandomSearch) => void;
  readonly onModeChange: (mode: 'training' | 'submit') => void;
  readonly onOpenInNewTabChange?: (value: boolean) => void;
  readonly onPickRandom: () => void;
  readonly onAutopilotEnabledChange?: (value: boolean) => void;
  readonly onRandomProvidersChange: (
    providers: readonly DesktopRandomJobProviderId[],
  ) => void;
  readonly onRunAutofill: () => void;
  readonly onRunSubmit: () => void;
  readonly onSaveCurrentSearch: () => void;
  readonly onSearchLocationChange: (value: string) => void;
  readonly onSearchRemoteChange: (value: boolean) => void;
  readonly onSearchTitleChange: (value: string) => void;
  readonly onToggleAutofillPause?: () => void;
  readonly onToggleAutopilot?: () => void;
  readonly onToggleAutopilotPause?: () => void;
  readonly openInNewTab?: boolean;
  readonly randomProviders: readonly DesktopRandomJobProviderId[];
  readonly runtimeProviders: readonly string[];
  readonly runtimeProviderOptions: readonly DesktopRuntimeProviderInfo[];
  readonly onRuntimeProvidersChange: (providers: readonly string[]) => void;
  readonly savedSearches: readonly SavedRandomSearch[];
  readonly searchLocation: string;
  readonly searchRemote: boolean;
  readonly searchTitle: string;
}

export function DesktopControlPanel({
  aiProvider,
  applicationUrl,
  authStatus,
  isAutopilotActive = false,
  isAutopilotPaused = false,
  isAutofillPaused = false,
  isAutopilotEnabled = false,
  isPickingRandom,
  isRunning,
  mode,
  onAiProviderChange,
  onCancelRun,
  onLoadSavedSearch,
  onModeChange,
  onOpenInNewTabChange,
  onPickRandom,
  onAutopilotEnabledChange,
  onRandomProvidersChange,
  onRunAutofill,
  onRunSubmit,
  onSaveCurrentSearch,
  onSearchLocationChange,
  onSearchRemoteChange,
  onSearchTitleChange,
  onToggleAutofillPause,
  onToggleAutopilot,
  onToggleAutopilotPause,
  openInNewTab = false,
  randomProviders,
  runtimeProviders,
  runtimeProviderOptions,
  onRuntimeProvidersChange,
  savedSearches,
  searchLocation,
  searchRemote,
  searchTitle,
}: DesktopControlPanelProps) {
  const [searchOpen, setSearchOpen] = useState(true);
  const [aiOpen, setAiOpen] = useState(true);
  const [applyOpen, setApplyOpen] = useState(true);
  const runActionMode: RunActionMode =
    mode === 'submit' ? 'submit' : 'autofill';
  const setRunActionMode = (next: RunActionMode) => {
    onModeChange(next === 'submit' ? 'submit' : 'training');
  };
  const controlsDisabled = isRunning || isPickingRandom || isAutopilotActive;
  const runDisabled =
    authStatus !== 'paired' ||
    !applicationUrl.trim() ||
    isRunning ||
    isPickingRandom;
  const handleStart = () => {
    if (isAutopilotEnabled && !isAutopilotActive && onToggleAutopilot) {
      onToggleAutopilot();
      return;
    }
    if (runActionMode === 'autofill') {
      onRunAutofill();
    } else {
      onRunSubmit();
    }
  };
  const selectedProviders = getSelectedProviderValues(randomProviders);
  const selectedProviderSet = new Set(selectedProviders);
  const providerLabel = formatSelectedProviders(randomProviders);
  const handleToggleProvider = (provider: DesktopRandomJobProviderId) => {
    if (selectedProviderSet.has(provider)) {
      onRandomProvidersChange(
        selectedProviders.filter(selected => selected !== provider),
      );
      return;
    }
    onRandomProvidersChange([...selectedProviders, provider]);
  };
  const runtimeProviderSet = new Set(runtimeProviders);
  const runtimeProviderLabel =
    runtimeProviderOptions.length > 0 &&
    runtimeProviderSet.size === runtimeProviderOptions.length
      ? 'All ATS'
      : runtimeProviderSet.size === 0
        ? 'Pick an ATS'
        : runtimeProviderSet.size === 1
          ? (runtimeProviderOptions.find(option =>
              runtimeProviderSet.has(option.id),
            )?.label ?? '1 ATS')
          : `${runtimeProviderSet.size} ATS`;
  const handleToggleRuntimeProvider = (id: string) => {
    if (runtimeProviderSet.has(id)) {
      onRuntimeProvidersChange(
        runtimeProviders.filter(selected => selected !== id),
      );
      return;
    }
    onRuntimeProvidersChange([...runtimeProviders, id]);
  };

  return (
    <div
      className={`desktop-sidebar-control-panel${
        controlsDisabled ? ' is-busy' : ''
      }`}
    >
      <section className="desktop-sidebar-card desktop-sidebar-card--training">
        <Collapsible
          open={!controlsDisabled && searchOpen}
          onOpenChange={setSearchOpen}
        >
          <div className="desktop-sidebar-collapsible-section" data-section="0">
            <CollapsibleTrigger className="desktop-sidebar-section-header desktop-sidebar-section-trigger">
              <h3>Search</h3>
              <ChevronDown aria-hidden="true" />
            </CollapsibleTrigger>
            <CollapsibleContent
              className="desktop-sidebar-collapsible-content"
              forceMount
            >
              <div className="desktop-sidebar-section-body desktop-sidebar-section-body--search">
                <div className="desktop-sidebar-search-top-row">
                  <label className="desktop-sidebar-control-field">
                    <span>Providers</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          className="desktop-provider-multiselect-trigger"
                          disabled={controlsDisabled}
                          type="button"
                          variant="outline"
                        >
                          <span>{providerLabel}</span>
                          <ChevronDown
                            aria-hidden="true"
                            className="ml-auto size-4 opacity-50"
                          />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="max-h-[344px] w-72 overflow-y-auto"
                      >
                        <DropdownMenuLabel>Providers</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {providerOptions.map(provider => (
                          <DropdownMenuCheckboxItem
                            checked={selectedProviderSet.has(provider.value)}
                            key={provider.value}
                            onCheckedChange={() =>
                              handleToggleProvider(provider.value)
                            }
                            onSelect={event => event.preventDefault()}
                          >
                            {provider.label}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </label>
                  <label className="desktop-sidebar-control-field">
                    <span>Train on ATS</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          className="desktop-provider-multiselect-trigger"
                          disabled={controlsDisabled}
                          type="button"
                          variant="outline"
                        >
                          <span>{runtimeProviderLabel}</span>
                          <ChevronDown
                            aria-hidden="true"
                            className="ml-auto size-4 opacity-50"
                          />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="max-h-[344px] w-72 overflow-y-auto"
                      >
                        <DropdownMenuLabel>Runtime ATS</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {runtimeProviderOptions.map(option => (
                          <DropdownMenuCheckboxItem
                            checked={runtimeProviderSet.has(option.id)}
                            key={option.id}
                            onCheckedChange={() =>
                              handleToggleRuntimeProvider(option.id)
                            }
                            onSelect={event => event.preventDefault()}
                          >
                            <span className="flex w-full items-center justify-between gap-2">
                              <span>{option.label}</span>
                              {option.readiness !== 'production' ? (
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                  {option.readiness === 'manual_review'
                                    ? 'manual'
                                    : option.readiness}
                                </span>
                              ) : null}
                            </span>
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </label>
                  <label className="desktop-sidebar-control-field desktop-sidebar-saved-search-field">
                    <span className="desktop-sidebar-inline-label">
                      <Star aria-hidden="true" />
                      Searches
                    </span>
                    <SavedRandomSearchSelect
                      disabled={controlsDisabled}
                      onLoad={onLoadSavedSearch}
                      savedSearches={savedSearches}
                    />
                  </label>
                </div>

                <div className="desktop-sidebar-title-row">
                  <label className="desktop-sidebar-control-field">
                    <span>Title</span>
                    <Input
                      disabled={controlsDisabled}
                      onChange={event =>
                        onSearchTitleChange(event.target.value)
                      }
                      placeholder="software engineer"
                      value={searchTitle}
                    />
                  </label>
                </div>

                <div className="desktop-sidebar-location-row">
                  <label className="desktop-sidebar-control-field-switch">
                    <span>Remote only</span>
                    <div className="desktop-sidebar-switch-control">
                      <Switch
                        aria-label="Remote only"
                        checked={searchRemote}
                        disabled={controlsDisabled}
                        onCheckedChange={onSearchRemoteChange}
                        size="sm"
                      />
                    </div>
                  </label>
                  <label className="desktop-sidebar-control-field">
                    <span>Location</span>
                    <Input
                      disabled={controlsDisabled || searchRemote}
                      onChange={event =>
                        onSearchLocationChange(event.target.value)
                      }
                      placeholder="San Francisco"
                      value={searchLocation}
                    />
                  </label>
                </div>

                <div className="desktop-sidebar-search-actions">
                  <Button
                    disabled={controlsDisabled}
                    onClick={onSaveCurrentSearch}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Star aria-hidden="true" />
                    Save
                  </Button>
                  <Button
                    className="desktop-sidebar-load-action"
                    disabled={authStatus !== 'paired' || controlsDisabled}
                    onClick={onPickRandom}
                    size="sm"
                    type="button"
                  >
                    {isPickingRandom ? (
                      <span className="inline-spinner" aria-hidden="true" />
                    ) : (
                      <Shuffle aria-hidden="true" />
                    )}
                    Load Job
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        <Separator className="desktop-sidebar-full-separator" />

        <Collapsible
          open={!controlsDisabled && aiOpen}
          onOpenChange={setAiOpen}
        >
          <div className="desktop-sidebar-collapsible-section" data-section="1">
            <CollapsibleTrigger className="desktop-sidebar-section-header desktop-sidebar-section-trigger">
              <h3>AI</h3>
              <ChevronDown aria-hidden="true" />
            </CollapsibleTrigger>
            <CollapsibleContent
              className="desktop-sidebar-collapsible-content"
              forceMount
            >
              <div className="desktop-sidebar-section-body">
                <label className="desktop-sidebar-control-field">
                  <span>Provider</span>
                  <Select
                    disabled={controlsDisabled}
                    value={aiProvider}
                    onValueChange={value =>
                      onAiProviderChange(value as DesktopAiProvider)
                    }
                  >
                    <SelectTrigger className="w-fit min-w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="ollama">Ollama</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </label>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        <Separator className="desktop-sidebar-full-separator" />

        <Collapsible
          open={!controlsDisabled && applyOpen}
          onOpenChange={setApplyOpen}
        >
          <div
            className="desktop-sidebar-collapsible-section desktop-sidebar-section--run"
            data-section="2"
          >
            <CollapsibleTrigger className="desktop-sidebar-section-header desktop-sidebar-section-trigger">
              <h3>Apply</h3>
              <span>
                {isAutopilotActive
                  ? isAutopilotPaused
                    ? 'Autopilot paused'
                    : 'Autopilot running'
                  : isRunning
                    ? isAutofillPaused
                      ? `${runActionMode === 'submit' ? 'Submit' : 'Autofill'} paused`
                      : `${runActionMode === 'submit' ? 'Submitting' : 'Filling'}…`
                    : 'Idle'}
              </span>
              <ChevronDown aria-hidden="true" />
            </CollapsibleTrigger>
            <CollapsibleContent
              className="desktop-sidebar-collapsible-content"
              forceMount
            >
              <div className="desktop-sidebar-section-body">
                {onOpenInNewTabChange ? (
                  <ControlSwitch
                    checked={openInNewTab}
                    disabled={controlsDisabled}
                    icon={SquareArrowOutUpRight}
                    label="Open new applications in a new tab"
                    onCheckedChange={onOpenInNewTabChange}
                    supportingText="Load the next picked job in a fresh assist tab."
                  />
                ) : null}

                <div className="desktop-run-mode-switches" role="radiogroup">
                  <ControlSwitch
                    checked={runActionMode === 'autofill'}
                    disabled={controlsDisabled}
                    icon={PencilLine}
                    label="Autofill"
                    onCheckedChange={checked => {
                      if (checked) setRunActionMode('autofill');
                    }}
                    role="radio"
                    supportingText="Fill the application fields without submitting."
                  />
                  <ControlSwitch
                    checked={runActionMode === 'submit'}
                    disabled={controlsDisabled}
                    icon={Send}
                    label="Submit"
                    onCheckedChange={checked => {
                      if (checked) setRunActionMode('submit');
                    }}
                    role="radio"
                    supportingText="Fill fields and submit when allowed."
                  />
                </div>

                {onAutopilotEnabledChange ? (
                  <ControlSwitch
                    checked={isAutopilotEnabled}
                    disabled={authStatus !== 'paired' || controlsDisabled}
                    icon={Repeat}
                    label="Autopilot"
                    onCheckedChange={onAutopilotEnabledChange}
                    supportingText="Use Start to pick matching jobs and run the selected mode."
                  />
                ) : null}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        <div className="desktop-run-primary">
          {isRunning && !isAutopilotActive && onToggleAutofillPause ? (
            <button
              aria-label={
                isAutofillPaused ? 'Resume autofill' : 'Pause autofill'
              }
              aria-pressed={isAutofillPaused}
              className="desktop-run-cta desktop-run-cta--pause"
              onClick={onToggleAutofillPause}
              type="button"
            >
              {isAutofillPaused ? (
                <Play aria-hidden="true" className="desktop-toolbar-icon" />
              ) : (
                <Pause aria-hidden="true" className="desktop-toolbar-icon" />
              )}
              {isAutofillPaused ? 'Resume' : 'Pause'}
            </button>
          ) : isAutopilotActive && onToggleAutopilotPause ? (
            <button
              aria-label={
                isAutopilotPaused ? 'Resume autopilot' : 'Pause autopilot'
              }
              aria-pressed={isAutopilotPaused}
              className="desktop-run-cta desktop-run-cta--pause"
              onClick={onToggleAutopilotPause}
              type="button"
            >
              {isAutopilotPaused ? (
                <Play aria-hidden="true" className="desktop-toolbar-icon" />
              ) : (
                <Pause aria-hidden="true" className="desktop-toolbar-icon" />
              )}
              {isAutopilotPaused ? 'Resume' : 'Pause'}
            </button>
          ) : (
            <Button
              aria-label={`Start ${runActionMode}`}
              className="desktop-sidebar-primary-action"
              disabled={runDisabled}
              onClick={handleStart}
              size="sm"
              type="button"
            >
              <Play aria-hidden="true" />
              Start
            </Button>
          )}

          {isRunning && !isAutopilotActive ? (
            <button
              aria-label="Stop the current run"
              className="desktop-run-cta desktop-run-cta--stop"
              onClick={onCancelRun}
              type="button"
            >
              <Square
                aria-hidden="true"
                className="desktop-toolbar-icon desktop-toolbar-icon--stop"
                fill="currentColor"
              />
              Stop
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export interface DesktopBrowserBarProps {
  readonly applicationUrl: string;
  readonly canGoBack?: boolean;
  readonly canGoForward?: boolean;
  readonly isSavedMenuOpen: boolean;
  readonly isEyeSaverMode: boolean;
  readonly onApplicationUrlChange: (value: string) => void;
  readonly onBack?: () => void;
  readonly onForward?: () => void;
  readonly onLoadSavedJob: (draft: SavedSubmitLeadDraft) => void;
  readonly onReload: () => void;
  readonly onRemoveSavedJob: (applicationUrl: string) => void;
  readonly onSaveCurrentJob: () => void;
  readonly onSubmitUrl: () => void;
  readonly onToggleSavedMenu: () => void;
  readonly onToggleEyeSaverMode: () => void;
  readonly savedDrafts: readonly SavedSubmitLeadDraft[];
}

export function DesktopBrowserBar({
  applicationUrl,
  canGoBack = false,
  canGoForward = false,
  isSavedMenuOpen,
  isEyeSaverMode,
  onApplicationUrlChange,
  onBack,
  onForward,
  onLoadSavedJob,
  onReload,
  onRemoveSavedJob,
  onSaveCurrentJob,
  onSubmitUrl,
  onToggleSavedMenu,
  onToggleEyeSaverMode,
  savedDrafts,
}: DesktopBrowserBarProps) {
  return (
    <div
      className="desktop-browser-bar"
      role="toolbar"
      aria-label="Browser controls"
    >
      <div className="desktop-toolbar-group">
        <ToolbarIconButton
          disabled={!onBack || !canGoBack}
          icon={ArrowLeft}
          label="Back"
          onClick={onBack ?? (() => undefined)}
          pressed={false}
        />
        <ToolbarIconButton
          disabled={!onForward || !canGoForward}
          icon={ArrowRight}
          label="Forward"
          onClick={onForward ?? (() => undefined)}
          pressed={false}
        />
        <ToolbarIconButton
          icon={RotateCw}
          label="Reload"
          onClick={onReload}
          pressed={false}
        />
      </div>

      <form
        className="desktop-toolbar-search"
        onSubmit={event => {
          event.preventDefault();
          onSubmitUrl();
        }}
        role="search"
      >
        <Search className="desktop-toolbar-search-icon" aria-hidden="true" />
        <input
          aria-label="Application URL"
          autoComplete="off"
          onChange={event => onApplicationUrlChange(event.target.value)}
          placeholder="greenhouse.io/company/jobs/..."
          spellCheck={false}
          type="url"
          value={applicationUrl}
        />
      </form>

      <ToolbarSavedMenu
        applicationUrl={applicationUrl}
        isOpen={isSavedMenuOpen}
        onLoad={onLoadSavedJob}
        onRemove={onRemoveSavedJob}
        onSave={onSaveCurrentJob}
        onToggle={onToggleSavedMenu}
        savedDrafts={savedDrafts}
      />

      <ToolbarIconButton
        icon={Eye}
        label={
          isEyeSaverMode ? 'Disable eye saver mode' : 'Enable eye saver mode'
        }
        onClick={onToggleEyeSaverMode}
        pressed={isEyeSaverMode}
      />
    </div>
  );
}

function ToolbarSearchPopover({
  aiProvider,
  applicationUrl,
  authStatus,
  isOpen,
  isPickingRandom,
  isSavedMenuOpen,
  onAiProviderChange,
  onClose,
  onLoadSavedJob,
  onPickRandom,
  onRandomProvidersChange,
  onRemoveSavedJob,
  onSaveCurrentJob,
  onSearchLocationChange,
  onSearchRemoteChange,
  onSearchTitleChange,
  onToggle,
  onToggleSavedMenu,
  popoverRef,
  randomProviders,
  savedDrafts,
  searchLocation,
  searchRemote,
  searchTitle,
}: {
  readonly aiProvider: DesktopAiProvider;
  readonly applicationUrl: string;
  readonly authStatus: DesktopAuthStatus;
  readonly isOpen: boolean;
  readonly isPickingRandom: boolean;
  readonly isSavedMenuOpen: boolean;
  readonly onAiProviderChange: (provider: DesktopAiProvider) => void;
  readonly onClose: () => void;
  readonly onLoadSavedJob: (draft: SavedSubmitLeadDraft) => void;
  readonly onPickRandom: () => void;
  readonly onRandomProvidersChange: (
    providers: readonly DesktopRandomJobProviderId[],
  ) => void;
  readonly onRemoveSavedJob: (applicationUrl: string) => void;
  readonly onSaveCurrentJob: () => void;
  readonly onSearchLocationChange: (value: string) => void;
  readonly onSearchRemoteChange: (value: boolean) => void;
  readonly onSearchTitleChange: (value: string) => void;
  readonly onToggle: () => void;
  readonly onToggleSavedMenu: () => void;
  readonly popoverRef: RefObject<HTMLDivElement | null>;
  readonly randomProviders: readonly DesktopRandomJobProviderId[];
  readonly savedDrafts: readonly SavedSubmitLeadDraft[];
  readonly searchLocation: string;
  readonly searchRemote: boolean;
  readonly searchTitle: string;
}) {
  const selectedProviders = getSelectedProviderValues(randomProviders);
  const selectedProviderSet = new Set(selectedProviders);
  const handleToggleProvider = (provider: DesktopRandomJobProviderId) => {
    if (selectedProviderSet.has(provider)) {
      onRandomProvidersChange(
        selectedProviders.filter(selected => selected !== provider),
      );
      return;
    }
    onRandomProvidersChange([...selectedProviders, provider]);
  };

  return (
    <div className="desktop-toolbar-search-popover-shell" ref={popoverRef}>
      <ToolbarIconButton
        icon={SlidersHorizontal}
        label="Search filters"
        onClick={onToggle}
        pressed={isOpen}
      />
      {isOpen ? (
        <section
          aria-label="Search filters"
          className="desktop-toolbar-search-popover"
          role="dialog"
        >
          <div className="desktop-toolbar-search-popover-grid">
            <div className="desktop-toolbar-field">
              <span className="desktop-toolbar-field-label">AI</span>
              <Select
                value={aiProvider}
                onValueChange={value =>
                  onAiProviderChange(value as DesktopAiProvider)
                }
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="openai">OpenAI (gpt-4o-mini)</SelectItem>
                    <SelectItem value="ollama">Local (Ollama)</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="desktop-toolbar-field">
              <span className="desktop-toolbar-field-label">Providers</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="desktop-provider-multiselect-trigger"
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <span>{formatSelectedProviders(randomProviders)}</span>
                    <ChevronDown aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="max-h-80 w-72 overflow-y-auto"
                >
                  <DropdownMenuLabel>Providers</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {providerOptions.map(provider => (
                    <DropdownMenuCheckboxItem
                      checked={selectedProviderSet.has(provider.value)}
                      key={provider.value}
                      onCheckedChange={() =>
                        handleToggleProvider(provider.value)
                      }
                      onSelect={event => event.preventDefault()}
                    >
                      {provider.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="desktop-toolbar-field desktop-toolbar-field--input">
              <span className="desktop-toolbar-field-label">Title</span>
              <Input
                size="sm"
                onChange={event => onSearchTitleChange(event.target.value)}
                placeholder="software engineer"
                value={searchTitle}
              />
            </div>

            <Checkbox
              ariaLabel="Remote only"
              checked={searchRemote}
              onCheckedChange={checked =>
                onSearchRemoteChange(checked === true)
              }
              label="Remote only"
              className="desktop-toolbar-checkbox"
            />

            <div className="desktop-toolbar-field desktop-toolbar-field--input">
              <span className="desktop-toolbar-field-label">Location</span>
              <Input
                size="sm"
                disabled={searchRemote}
                onChange={event => onSearchLocationChange(event.target.value)}
                placeholder="San Francisco"
                value={searchLocation}
              />
            </div>
          </div>

          <div className="desktop-toolbar-search-popover-actions">
            <button
              className="desktop-toolbar-action"
              disabled={authStatus !== 'paired' || isPickingRandom}
              onClick={() => {
                onPickRandom();
                onClose();
              }}
              type="button"
            >
              {isPickingRandom ? (
                <span className="inline-spinner" aria-hidden="true" />
              ) : (
                <Shuffle aria-hidden="true" className="desktop-toolbar-icon" />
              )}
              Random
            </button>

            <ToolbarSavedMenu
              applicationUrl={applicationUrl}
              isOpen={isSavedMenuOpen}
              onLoad={draft => {
                onLoadSavedJob(draft);
                onClose();
              }}
              onRemove={onRemoveSavedJob}
              onSave={onSaveCurrentJob}
              onToggle={onToggleSavedMenu}
              savedDrafts={savedDrafts}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ControlSwitch({
  checked,
  disabled,
  icon: Icon,
  label,
  onCheckedChange,
  role,
  supportingText,
}: {
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly icon?: LucideIcon;
  readonly label: string;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly role?: 'radio';
  readonly supportingText?: string;
}) {
  return (
    <label className="desktop-control-switch">
      {Icon ? (
        <span aria-hidden="true" className="desktop-control-switch-icon">
          <Icon />
        </span>
      ) : null}
      <span className="desktop-control-switch-copy">
        <span className="desktop-control-switch-label">{label}</span>
        {supportingText ? (
          <span className="desktop-control-switch-support">
            {supportingText}
          </span>
        ) : null}
      </span>
      <Switch
        aria-checked={checked}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        role={role}
        size="sm"
      />
    </label>
  );
}

function SaveCurrentJobButton({
  applicationUrl,
  onSave,
}: {
  readonly applicationUrl: string;
  readonly onSave: () => void;
}) {
  return (
    <button
      aria-label="Save current job"
      className="desktop-toolbar-action desktop-toolbar-action--icon desktop-toolbar-action--save"
      disabled={!applicationUrl.trim()}
      onClick={onSave}
      title="Save current job"
      type="button"
    >
      <Star aria-hidden="true" className="desktop-toolbar-icon" />
    </button>
  );
}

function SavedDraftPicker({
  isOpen,
  onLoad,
  onRemove,
  onToggle,
  savedDrafts,
}: {
  readonly isOpen: boolean;
  readonly onLoad: (draft: SavedSubmitLeadDraft) => void;
  readonly onRemove: (applicationUrl: string) => void;
  readonly onToggle: () => void;
  readonly savedDrafts: readonly SavedSubmitLeadDraft[];
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  useClickOutsideAndEscape(
    wrapperRef,
    () => {
      if (isOpen) onToggle();
    },
    { enabled: isOpen },
  );

  return (
    <div className="desktop-toolbar-saved-menu" ref={wrapperRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Saved jobs"
        className="desktop-toolbar-action desktop-toolbar-action--saved-list"
        disabled={savedDrafts.length === 0}
        onClick={onToggle}
        title="Saved jobs"
        type="button"
      >
        <Star aria-hidden="true" className="desktop-toolbar-icon" />
        <span className="desktop-toolbar-saved-count">
          {savedDrafts.length}
        </span>
        <ChevronDown aria-hidden="true" className="desktop-toolbar-icon" />
      </button>
      {isOpen && savedDrafts.length > 0 ? (
        <SavedDraftPopover
          onLoad={onLoad}
          onRemove={onRemove}
          savedDrafts={savedDrafts}
        />
      ) : null}
    </div>
  );
}

function SavedRandomSearchSelect({
  disabled,
  onLoad,
  savedSearches,
}: {
  readonly disabled?: boolean;
  readonly onLoad: (search: SavedRandomSearch) => void;
  readonly savedSearches: readonly SavedRandomSearch[];
}) {
  return (
    <Select
      disabled={disabled || savedSearches.length === 0}
      onValueChange={value => {
        const search = savedSearches.find(item => item.id === value);
        if (search) onLoad(search);
      }}
    >
      <SelectTrigger className="desktop-saved-search-select-trigger">
        <SelectValue placeholder="Saved searches" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {savedSearches.map(search => (
            <SelectItem key={search.id} value={search.id}>
              {search.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function SavedDraftPopover({
  onLoad,
  onRemove,
  savedDrafts,
}: {
  readonly onLoad: (draft: SavedSubmitLeadDraft) => void;
  readonly onRemove: (applicationUrl: string) => void;
  readonly savedDrafts: readonly SavedSubmitLeadDraft[];
}) {
  return (
    <div className="desktop-toolbar-saved-popover" role="menu">
      {savedDrafts.map(draft => (
        <div className="desktop-toolbar-saved-row" key={draft.applicationUrl}>
          <button
            className="desktop-toolbar-saved-item"
            onClick={() => onLoad(draft)}
            role="menuitem"
            type="button"
          >
            <span>{draft.title || draft.applicationUrl}</span>
            <span className="desktop-toolbar-saved-mode">{draft.mode}</span>
          </button>
          <button
            aria-label={`Remove ${draft.title || draft.applicationUrl}`}
            className="desktop-toolbar-saved-remove"
            onClick={() => onRemove(draft.applicationUrl)}
            type="button"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function ToolbarSavedMenu({
  applicationUrl,
  isOpen,
  onLoad,
  onRemove,
  onSave,
  onToggle,
  savedDrafts,
}: {
  readonly applicationUrl: string;
  readonly isOpen: boolean;
  readonly onLoad: (draft: SavedSubmitLeadDraft) => void;
  readonly onRemove: (applicationUrl: string) => void;
  readonly onSave: () => void;
  readonly onToggle: () => void;
  readonly savedDrafts: readonly SavedSubmitLeadDraft[];
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  useClickOutsideAndEscape(
    wrapperRef,
    () => {
      if (isOpen) onToggle();
    },
    { enabled: isOpen },
  );

  return (
    <div className="desktop-toolbar-saved-menu" ref={wrapperRef}>
      <SaveCurrentJobButton applicationUrl={applicationUrl} onSave={onSave} />
      <SavedDraftPicker
        isOpen={isOpen}
        onLoad={onLoad}
        onRemove={onRemove}
        onToggle={onToggle}
        savedDrafts={savedDrafts}
      />
    </div>
  );
}

function useClickOutsideAndEscape(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  { enabled }: { enabled: boolean },
) {
  useEffect(() => {
    if (!enabled) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (ref.current?.contains(target)) return;
      onClose();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [enabled, onClose, ref]);
}

interface ToolbarIconButtonProps {
  readonly badge?: number;
  readonly disabled?: boolean;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly onClick: () => void;
  readonly pressed: boolean;
  readonly ref?: Ref<HTMLButtonElement>;
}

function ToolbarIconButton({
  badge,
  disabled,
  icon: Icon,
  label,
  onClick,
  pressed,
  ref,
}: ToolbarIconButtonProps) {
  return (
    <button
      aria-label={label}
      aria-pressed={pressed}
      className="desktop-toolbar-icon-button"
      disabled={disabled}
      onClick={onClick}
      ref={ref}
      title={label}
      type="button"
    >
      <Icon className="desktop-toolbar-icon" aria-hidden="true" />
      {badge !== undefined && badge > 0 ? (
        <span className="desktop-toolbar-badge">{badge}</span>
      ) : null}
    </button>
  );
}
