"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TagInput from "@/components/ui/tag-input";
import { loadDefaultModel, saveDefaultModel, loadMockupProvider, saveMockupProvider, loadIdeogramDefaults, saveIdeogramDefaults, loadSavedMockups, saveSavedMockups, saveWorkflowImagesIndexedDB, loadWorkflowImagesIndexedDB, clearSavedMockups, clearWorkflowImages, clearWorkflowImagesIndexedDB, type MockupProvider, loadUserStyles, saveUserStyles, type UserStyle, loadUpscaleProvider, saveUpscaleProvider, loadIdeogramUpscaleSettings, saveIdeogramUpscaleSettings, type UpscaleProvider, type IdeogramDefaults } from "@/lib/storage";
import type { IdeogramAspectRatio, IdeogramMagicPrompt, IdeogramRenderingSpeed, IdeogramStyleType } from "@/lib/ideogram";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Copy, Download, Loader2, Save, Trash2, Image as ImageIcon, Maximize2, Settings, GitMerge, X, Shuffle, Dice5, Star, ChevronLeft, ChevronRight, Upload as UploadIcon, Edit3 as EditIcon } from "lucide-react";
import { RotateCcw as RefreshIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import type { WorkflowImage } from "@/lib/types";
import { useToast } from "@/components/ui/toast";
import MyStylesManager from "@/components/MyStylesManager";
import { getNichePreset } from "@/lib/niche-presets";

type IdeaStatus = "pending" | "completed";

interface DesignIdeaRow {
  id: string;
  description: string;
  prompt: string;
  model: string;
  tags: string[];
  status: IdeaStatus;
  saved: boolean;
  createdAt: number;
  imagePrompt?: string;
  imgTone?: string;
  imgStyle?: string;
}

const STORAGE_KEY = "merchalyzer.designIdeas.v1";

const DEFAULT_MODELS: Array<{ value: string; label: string }> = [
  { value: "openrouter/auto", label: "OpenRouter Auto" },
  { value: "openai/gpt-5", label: "OpenAI GPT-5" },
  { value: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B" },
  { value: "openai/gpt-5-mini", label: "OpenAI GPT-5 Mini" },
  { value: "openai/gpt-4o-mini-2024-07-18", label: "GPT-4o mini" },
  { value: "meta-llama/llama-4-maverick:free", label: "Llama 4 Maverick (free)" },
  { value: "google/gemini-2.5-flash-image-preview", label: "Gemini 2.5 Flash" },
];

// Tone and style options (keep 'Auto' first)
const TONE_OPTIONS: string[] = [
  'Auto',
  'Funny',
  'Sarcastic',
  'Inspirational',
  'Playful',
  'Minimalist',
  'Vintage',
  'Gothic',
  'Bold',
  'Elegant',
  'Professional',
  'Friendly',
  'Edgy',
  'Youthful',
  'Feminine',
  'Masculine',
];

const STYLE_OPTIONS: string[] = [
  'Auto',
  'Kawaii Retro 1 - Custom',
  'Vintage Distressed',
  'Bold Sans Typography',
  'Minimalist Line Art',
  'Hand‑Lettered Script',
  'Retro 70s',
  'Anime Manga',
  'Kawaii Chibi',
  'Cartoon Mascot',
  'Pop Art',
  'Grunge Streetwear',
  'Y2K',
  'Sports Jersey',
  'Gothic Blackletter',
  'Sticker Style',
  'Graffiti',
  'Tattoo Old School',
  'Cyberpunk',
  'Halftone',
  'Psychedelic',
];

// Optional: Expand certain custom styles into richer prompt text for consistency
const STYLE_PROMPT_MAP: Record<string, string> = {
  'Kawaii Retro 1 - Custom': [
    'Kawaii / cute aesthetic with personified 80s gadgets (boombox, floppy disk, Game Boy, cassette), smiling faces, rosy cheeks, rounded shapes.',
    'Flat vector illustration with bold outlines, clean shapes, solid vibrant colors, no gradients or shading.',
    'Cartoon pop‑art vibe with simplified, exaggerated features and nostalgic pop‑culture references.',
    'Retro 1980s technology theme (cassette tapes, floppy disk, Game Boy, boombox).',
    'Playful rounded typography, star/sparkle accents; fun, retro vibe.',
    'Concise label: Kawaii retro vector illustration with a flat, cartoon pop‑art style, themed around 1980s nostalgia.'
  ].join(' '),
};

// Default niche catalogs (hoisted to module scope so useEffect deps are stable)
const DEFAULT_PRIMARY_NICHES: string[] = [
  'Christian',
  'Electrician',
  'Plumber',
  'Teacher',
  'Nurse',
  'Fitness',
  'Gamer',
  'Anime',
  'Cat Lovers',
  'Dog Lovers',
  'Southern Culture',
  'Camping & Outdoors',
  'Coffee',
  'Mom Life',
  'Dad Life',
  'Sports Lovers',
];

const DEFAULT_SUB_NICHES: Record<string, string[]> = {
  'Anime': [
    'Shonen Action',
    'Shojo Romance',
    'Isekai Fantasy',
    'Mecha Robots',
    'Samurai & Ninja',
    'Kawaii Chibi',
    'Magical Girl',
    'Retro 90s Aesthetic',
    'Manga Panel Layout',
    'Kitsune & Neko',
  ],
  'Christian': [
    'Christian Humor',
    'Christian Sarcasm Humour',
    'Worship & Music Ministry',
    'Motherhood & Fatherhood',
    'Youth Ministry & Gen Z Faith',
    'Marriage & Relationships',
    'Sports & Fitness with Faith',
    'Southern & Country Christian Culture',
    'Parenting & Family Life',
    'Christian Pets & Animals',
    'Church Fellowship & Potlucks',
    'Christian Streetwear / Minimalist Aesthetic',
    'Christian Patriot / Pro-Freedom Faith',
    'Bible Journaling & Scripture Art',
    'Christian Mental Health & Positivity',
  ],
  'Electrician': ['Apprentice', 'Journeyman', 'Lineman', 'Safety Humor', 'Voltage Puns', 'Tools & Gauges'],
  'Plumber': ['Apprentice', 'Journeyman', 'Master Plumber', 'Drain Cleaning', 'Pipefitting', 'Toilet Humor', 'Leak Detection'],
  'Teacher': ['Elementary', 'High School', 'Math', 'Science', 'PE', 'Homeschool', 'Teacher Humor'],
  'Nurse': ['ER', 'ICU', 'Pediatrics', 'Night Shift', 'Nurse Practitioner', 'Nurse Humor'],
  'Fitness': ['Weightlifting', 'CrossFit', 'Yoga', 'Running', 'Motivational', 'Gym Humor'],
  'Gamer': ['Retro', 'RPG', 'Console', 'PC', 'Pixel Art', 'Speedrun'],
  'Cat Lovers': ['Rescue', 'Black Cats', 'Chonky Cats', 'Cat Mom', 'Cat Dad', 'Cat Puns'],
  'Dog Lovers': ['Rescue', 'Dog Dad', 'Dog Mom', 'Golden Retrievers', 'Dachshunds', 'Pit Bulls', 'Walkies Humor'],
  'Southern Culture': ["Sweet Tea", 'Porch Swing', "Y'all", 'Country Roads', 'Cowboy Boots'],
  'Camping & Outdoors': ['Hiking', 'National Parks', 'Campfire', 'RV Life', 'Fishing', 'Kayaking'],
  'Coffee': ['Espresso', 'Barista', 'Cold Brew', 'Caffeine Jokes', 'Latte Art'],
  'Mom Life': ['Toddler Mom', 'Boy Mom', 'Girl Mom', 'Soccer Mom', 'Minivan Life'],
  'Dad Life': ['Grill Master', 'Lawn Care', 'Dad Jokes', 'DIY', 'Handyman'],
  'Sports Lovers': ['Baseball', 'Football', 'Basketball', 'Soccer', 'Golf', 'Pickleball'],
};

type SortKey = "date_desc" | "date_asc" | "status" | "model";
type FilterMode = "all" | "completed" | "pending" | "saved";

function uid(): string { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

export default function DesignGeneratorPage() {
  const { show } = useToast();
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState<number>(5);
  const [model, setModel] = useState<string>("openrouter/auto");
  const [tone, setTone] = useState<string>("Auto");
  const [tshirtStyle, setTshirtStyle] = useState<string>("Auto");
  const [isLoading, setIsLoading] = useState(false);
  // Progress bar state for idea generation
  const [progressVisible, setProgressVisible] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const progressTimerRef = useRef<number | null>(null);

  function beginFakeProgress(estimatedIdeas: number) {
    try { if (progressTimerRef.current) window.clearInterval(progressTimerRef.current); } catch {}
    setProgressPct(0);
    setProgressVisible(true);
    const start = Date.now();
    // Estimate ~1.2s per idea; clamp to 3–25s window
    const totalMs = Math.min(25000, Math.max(3000, (estimatedIdeas || 1) * 1200));
    const cap = 92 + Math.random() * 4; // 92–96% until completion
    const tick = 120;
    progressTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / totalMs);
      // Ease-in-out curve for smoother growth
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // 0..1
      const next = Math.min(cap, Math.max(4, eased * cap));
      setProgressPct(next);
    }, tick);
  }
  function finishFakeProgress() {
    try { if (progressTimerRef.current) window.clearInterval(progressTimerRef.current); } catch {}
    progressTimerRef.current = null;
    setProgressPct(100);
    window.setTimeout(() => { setProgressVisible(false); setProgressPct(0); }, 500);
  }
  useEffect(() => {
    return () => {
      try { if (progressTimerRef.current) window.clearInterval(progressTimerRef.current); } catch {}
    };
  }, []);
  const [rows, setRows] = useState<DesignIdeaRow[]>([]);
  const [niche, setNiche] = useState<string>("");
  const [primaryNiches, setPrimaryNiches] = useState<string[]>([]);
  const [subNichesByPrimary, setSubNichesByPrimary] = useState<Record<string, string[]>>({});
  const [subNiches, setSubNiches] = useState<string[]>([]);
  const [selectedPrimarySubs, setSelectedPrimarySubs] = useState<string[]>([]);
  const NICHES_KEY = 'merchalyzer.primaryNiches.v1';
  const SUB_NICHES_KEY = 'merchalyzer.subNiches.v1';
  const [newPrimary, setNewPrimary] = useState<string>("");

  // Filters & sorting
  const [sortKey, setSortKey] = useState<SortKey>("date_desc");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [filterModel, setFilterModel] = useState<string>("all");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [mockupModel, setMockupModel] = useState<string>("google/gemini-2.5-flash-image-preview");
  const [mockupProvider, setMockupProvider] = useState<MockupProvider>('ideogram');
  const [ideoAspect, setIdeoAspect] = useState<IdeogramAspectRatio>('1x1');
  const [ideoSpeed, setIdeoSpeed] = useState<IdeogramRenderingSpeed>('DEFAULT');
  const [ideoMagic, setIdeoMagic] = useState<IdeogramMagicPrompt>('ON');
  const [ideoStyle, setIdeoStyle] = useState<IdeogramStyleType>('DESIGN');
  const [ideoNegative, setIdeoNegative] = useState<string>('');
  const [ideoSeed, setIdeoSeed] = useState<string>('');
  // Ideogram Upscale settings (workflow)
  const [upscaleProvider, setUpscaleProvider] = useState<UpscaleProvider>('ideogram');
  const [upResemblance, setUpResemblance] = useState<number>(50);
  const [upDetail, setUpDetail] = useState<number>(50);
  const [upMagic, setUpMagic] = useState<'AUTO'|'ON'|'OFF'>('AUTO');
  const [upSeed, setUpSeed] = useState<string>('');
  const [activePreset, setActivePreset] = useState<{ primary: string; sub?: string } | null>(null);
  const [activeStyleDetails, setActiveStyleDetails] = useState<string>('');
  const [ideogramSaveState, setIdeogramSaveState] = useState<'idle'|'saving'|'saved'>('idle');
  const [modelSaveState, setModelSaveState] = useState<'idle'|'saving'|'saved'>('idle');
  const [mockups, setMockups] = useState<Record<string, string[]>>({});
  const [mockupLoading, setMockupLoading] = useState<Record<string, boolean>>({});
  const [previewOpenId, setPreviewOpenId] = useState<string | null>(null);
  const [previewOpenIndex, setPreviewOpenIndex] = useState<number>(0);
  const [mockupGenerateCounts, setMockupGenerateCounts] = useState<Record<string, number>>({});
  const [selectedMockups, setSelectedMockups] = useState<Record<string, string[]>>({});
  const [sendingToWorkflow, setSendingToWorkflow] = useState<Record<string, boolean>>({});
  const [sendSuccessCount, setSendSuccessCount] = useState<Record<string, number>>({});
  const [userStyles, setUserStyles] = useState<UserStyle[]>([]);
  const [selectedUserStyleIds, setSelectedUserStyleIds] = useState<string[]>([]);
  const [showStylesManager, setShowStylesManager] = useState(false);
  const [promptEditOpen, setPromptEditOpen] = useState<Record<string, boolean>>({});
  const [promptEditMode, setPromptEditMode] = useState<Record<string, 'prompt' | 'toneStyle' | 'both'>>({});
  const [promptDraft, setPromptDraft] = useState<Record<string, string>>({});
  const [toneDraft, setToneDraft] = useState<Record<string, string>>({});
  const [styleDraft, setStyleDraft] = useState<Record<string, string>>({});
  const [descLoading, setDescLoading] = useState<Record<string, boolean>>({});
  // Sanitize helper: avoid colons in outbound prompts
  const noColons = (s: string) => (s || '').replace(/:/g, ' — ');
  const [refreshOpen, setRefreshOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  function parseToneStyleFromPrompt(text: string): { tone?: string; style?: string } {
    const res: { tone?: string; style?: string } = {};
    try {
      const toneMatch = text.match(/Tone —\s*([^×\n]+)/i);
      if (toneMatch && toneMatch[1]) res.tone = toneMatch[1].trim();
      const styleMatch = text.match(/Style —\s*([^×\n]+)/i);
      if (styleMatch && styleMatch[1]) res.style = styleMatch[1].trim();
    } catch {}
    return res;
  }
  const [showSecondary, setShowSecondary] = useState(false);
  const [secondaryNiche, setSecondaryNiche] = useState<string>("");
  const [selectedSecondarySubs, setSelectedSecondarySubs] = useState<string[]>([]);
  const secondarySubs = useMemo(() => subNichesByPrimary[secondaryNiche] || [], [secondaryNiche, subNichesByPrimary]);


  // Load default model, mockup provider + ideogram defaults, niches, sub-niches, and persisted rows
  useEffect(() => {
    const def = loadDefaultModel();
    if (def) setModel(def);
    try {
      const prov = loadMockupProvider();
      setMockupProvider(prov);
      const ideo = loadIdeogramDefaults();
      if (ideo.aspect_ratio) setIdeoAspect(ideo.aspect_ratio as IdeogramAspectRatio);
      if (ideo.rendering_speed) setIdeoSpeed(ideo.rendering_speed as IdeogramRenderingSpeed);
      if (ideo.magic_prompt) setIdeoMagic(ideo.magic_prompt as IdeogramMagicPrompt);
      if (ideo.style_type) setIdeoStyle(ideo.style_type as IdeogramStyleType);
      if (typeof ideo.negative_prompt === 'string') setIdeoNegative(ideo.negative_prompt);
      if (typeof ideo.seed === 'number') setIdeoSeed(String(ideo.seed));
      // Load saved selections
      const saved = loadSavedMockups();
      setSelectedMockups(saved);
      // Load user styles
      const styles = loadUserStyles();
      setUserStyles(styles);
    } catch {}
    // Load Upscale provider + settings
    try {
      const prov = loadUpscaleProvider();
      setUpscaleProvider(prov);
      const up = loadIdeogramUpscaleSettings();
      if (typeof up.resemblance === 'number') setUpResemblance(up.resemblance);
      if (typeof up.detail === 'number') setUpDetail(up.detail);
      if (up.magic_prompt_option) setUpMagic(up.magic_prompt_option);
      if (typeof up.seed === 'number') setUpSeed(String(up.seed));
    } catch {}
    try {
      // Load and merge primary niches with defaults
      const rawN = window.localStorage.getItem(NICHES_KEY);
      const storedPrimaries = rawN ? (JSON.parse(rawN) as unknown) : undefined;
      let mergedPrimaries: string[] = [];
      if (Array.isArray(storedPrimaries)) {
        const set = new Set<string>([...DEFAULT_PRIMARY_NICHES, ...storedPrimaries.filter((s) => typeof s === 'string')]);
        mergedPrimaries = Array.from(set.values());
      } else {
        mergedPrimaries = DEFAULT_PRIMARY_NICHES;
      }
      setPrimaryNiches(mergedPrimaries);
      window.localStorage.setItem(NICHES_KEY, JSON.stringify(mergedPrimaries));

      // Load and merge sub-niches mapping with defaults
      const rawS = window.localStorage.getItem(SUB_NICHES_KEY);
      const storedMapping = rawS ? (JSON.parse(rawS) as unknown) : undefined;
      let mergedMapping: Record<string, string[]> = {};
      if (storedMapping && typeof storedMapping === 'object' && !Array.isArray(storedMapping)) {
        mergedMapping = { ...(storedMapping as Record<string, string[]>) };
      }
      for (const key of Object.keys(DEFAULT_SUB_NICHES)) {
        const current = mergedMapping[key];
        if (!Array.isArray(current) || current.length === 0) {
          mergedMapping[key] = DEFAULT_SUB_NICHES[key];
        }
      }
      // Always refresh Christian sub-niches to latest curated list
      mergedMapping['Christian'] = DEFAULT_SUB_NICHES['Christian'];
      setSubNichesByPrimary(mergedMapping);
      window.localStorage.setItem(SUB_NICHES_KEY, JSON.stringify(mergedMapping));

      // Default select Christian when available
      if (mergedPrimaries.includes('Christian')) {
        setNiche('Christian');
      } else if (mergedPrimaries.length > 0) {
        setNiche(mergedPrimaries[0]!);
      }
    } catch {}
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DesignIdeaRow[];
        if (Array.isArray(parsed)) setRows(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    // Persist rows
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {}
  }, [rows]);

  const modelsInData = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => set.add(r.model));
    return Array.from(set.values()).sort();
  }, [rows]);

  const IMAGE_MODELS: Array<{ value: string; label: string }> = [
    { value: "google/gemini-2.5-flash-image-preview", label: "Gemini 2.5 Flash Preview" },
    { value: "meta-llama/llama-4-maverick:free", label: "Llama 4 Maverick (exp)" },
  ];

  const filteredSortedRows = useMemo(() => {
    let out = rows.slice();
    // Filter mode
    if (filterMode === 'completed') out = out.filter(r => r.status === 'completed');
    if (filterMode === 'pending') out = out.filter(r => r.status !== 'completed');
    if (filterMode === 'saved') out = out.filter(r => r.saved);
    // Filter model
    if (filterModel !== 'all') out = out.filter(r => r.model === filterModel);
    // Filter tags (must include ALL filter tags)
    if (filterTags.length > 0) {
      out = out.filter(r => filterTags.every(t => r.tags.map(x => x.toLowerCase()).includes(t.toLowerCase())));
    }
    // Sort
    if (sortKey === 'date_desc') out.sort((a, b) => b.createdAt - a.createdAt);
    if (sortKey === 'date_asc') out.sort((a, b) => a.createdAt - b.createdAt);
    if (sortKey === 'model') out.sort((a, b) => a.model.localeCompare(b.model) || b.createdAt - a.createdAt);
    if (sortKey === 'status') out.sort((a, b) => (a.status === b.status ? b.createdAt - a.createdAt : a.status === 'completed' ? -1 : 1));
    return out;
  }, [rows, sortKey, filterMode, filterModel, filterTags]);

  // Effective prompt combines user prompt + selected primary/secondary niches
  const effectivePrompt = useMemo(() => {
    const parts: string[] = [];
    const base = (prompt || '').trim();
    if (base) parts.push(base);
    const baseLower = base.toLowerCase();
    const primaryToAdd = selectedPrimarySubs.filter(s => !baseLower.includes(s.toLowerCase()));
    if (niche && primaryToAdd.length > 0) {
      parts.push(`${niche} — ${primaryToAdd.join(', ')}`);
    }
    const secondaryToAdd = selectedSecondarySubs.filter(s => !baseLower.includes(s.toLowerCase()));
    if (secondaryNiche) {
      if (secondaryToAdd.length > 0) parts.push(`${secondaryNiche} — ${secondaryToAdd.join(', ')}`);
      else if (!baseLower.includes(secondaryNiche.toLowerCase())) parts.push(secondaryNiche);
    }
    return parts.join(' × ').trim();
  }, [prompt, niche, selectedPrimarySubs, secondaryNiche, selectedSecondarySubs]);

  function appendToPrompt(value: string) {
    setPrompt((prev) => {
      const prevTrim = (prev || '').trim();
      if (!prevTrim) return value;
      if (prevTrim.toLowerCase().includes(value.toLowerCase())) return prevTrim;
      return `${prevTrim} × ${value}`;
    });
  }

  function removeFromPrompt(value: string) {
    setPrompt((prev) => {
      const prevTrim = (prev || '').trim();
      if (!prevTrim) return prevTrim;
      const parts = prevTrim.split(/\s*×\s*/).filter(Boolean);
      const nextParts = parts.filter((p) => p.toLowerCase() !== value.toLowerCase());
      return nextParts.join(' × ');
    });
  }

  function withPrimaryPrefix(primary: string, sub: string): string {
    const p = (primary || '').trim();
    const s = (sub || '').trim();
    if (!p) return s;
    const sLower = s.toLowerCase();
    return sLower.startsWith(p.toLowerCase()) ? s : `${p} ${s}`;
  }

  function pickRandom<T>(arr: T[]): T | undefined {
    if (!Array.isArray(arr) || arr.length === 0) return undefined;
    const idx = Math.floor(Math.random() * arr.length);
    return arr[idx];
  }

  function randomizeSecondary() {
    if (!Array.isArray(primaryNiches) || primaryNiches.length === 0) return;
    setShowSecondary(true);
    const candidates = primaryNiches.filter((p) => p !== niche);
    const sec = pickRandom(candidates.length > 0 ? candidates : primaryNiches);
    if (!sec) return;
    setSecondaryNiche(sec);
    const subs = subNichesByPrimary[sec] || [];
    const sub = pickRandom(subs);
    setSelectedSecondarySubs(sub ? [sub] : []);
    // Ensure prompt is populated so Generate is enabled
    if (sub) appendToPrompt(withPrimaryPrefix(sec, sub));
    else appendToPrompt(sec);
  }

  function superRandomize() {
    if (!Array.isArray(primaryNiches) || primaryNiches.length === 0) return;
    const prim = pickRandom(primaryNiches);
    if (!prim) return;
    // Start fresh: clear prompt and selected lists
    setPrompt('');
    setNiche(prim);
    const primSubs = subNichesByPrimary[prim] || [];
    const psub = pickRandom(primSubs);
    // Clear selected before setting
    setSelectedPrimarySubs([]);
    // Wait a microtask so the effect that clears selectedPrimarySubs on niche change runs first
    setTimeout(() => {
      setSelectedPrimarySubs(psub ? [psub] : []);
    }, 0);

    // Secondary
    setShowSecondary(true);
    const secCandidates = primaryNiches.filter((n) => n !== prim);
    const sec = pickRandom(secCandidates.length > 0 ? secCandidates : primaryNiches);
    let ssub: string | undefined;
    if (sec) {
      setSecondaryNiche(sec);
      const ssubs = subNichesByPrimary[sec] || [];
      ssub = pickRandom(ssubs);
      setSelectedSecondarySubs(ssub ? [ssub] : []);
    } else {
      setSecondaryNiche('');
      setSelectedSecondarySubs([]);
    }

    // Compose a fresh prompt so Generate is enabled without leftovers
    const parts: string[] = [];
    parts.push(psub ? withPrimaryPrefix(prim, psub) : prim);
    if (ssub) parts.push(withPrimaryPrefix(sec || '', ssub)); else if (sec) parts.push(sec);
    setPrompt(parts.join(' × '));
  }

  function extractQuote(text: string): string | null {
    try {
      const m = text.match(/\bQuote\s*-\s*([^\.]+)\./i);
      return m && m[1] ? m[1].trim() : null;
    } catch { return null; }
  }
  function extractComposition(text: string): string | null {
    try {
      const m = text.match(/(The composition is centered against a flat dark grey background[^]*)$/i);
      return m && m[1] ? m[1].trim() : null;
    } catch { return null; }
  }

  async function regenerateDescription(row: DesignIdeaRow) {
    const quote = extractQuote(row.description || '') || '';
    if (!quote) {
      show({ title: 'No quote found', description: 'Cannot locate the Quote - … sentence.', variant: 'error' });
      return;
    }
    setDescLoading(prev => ({ ...prev, [row.id]: true }));
    try {
      const parsed = parseToneStyleFromPrompt(row.prompt || '');
      const res = await fetch('/api/design-ideas/description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote,
          model: row.model,
          contextPrompt: row.prompt,
          tone: row.imgTone || parsed.tone,
          tshirtStyle: row.imgStyle || parsed.style,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        try { const j = JSON.parse(text) as { error?: string }; show({ title: 'Regeneration failed', description: j.error || text, variant: 'error' }); }
        catch { show({ title: 'Regeneration failed', description: text, variant: 'error' }); }
        return;
      }
      const data = await res.json() as { description: string };
      const newDesc = (data.description || '').trim().replace(/^[-•\s]+/, '');
      const comp = extractComposition(row.description || '');
      const rebuilt = `Quote - ${quote}. ${newDesc}${comp ? (newDesc.endsWith('.') ? ' ' : ' ') + comp : ''}`;
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, description: rebuilt } : r));
      show({ title: 'Description updated', variant: 'success' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      show({ title: 'Regeneration error', description: msg, variant: 'error' });
    } finally {
      setDescLoading(prev => ({ ...prev, [row.id]: false }));
    }
  }

  function applyPreset(primary: string, sub: string) {
    const preset = getNichePreset(primary, sub);
    if (!preset) return;
    if (preset.tone) setTone(preset.tone);
    if (preset.tshirtStyle) setTshirtStyle(preset.tshirtStyle);
    setActiveStyleDetails((preset.styleDetails || '').trim());
    setActivePreset({ primary, sub });
    // Ensure the preset's sub‑niche is reflected in UI selections and prompt text.
    // Switch primary if needed, then select the sub‑niche and set prompt without duplicates.
    const label = withPrimaryPrefix(primary, sub);
    if (niche !== primary) {
      setNiche(primary);
      // selectedPrimarySubs is cleared on niche change; set after the effect runs
      setTimeout(() => {
        setSelectedPrimarySubs([sub]);
      }, 0);
    } else {
      // Selecting a preset should make this the only highlighted sub‑niche
      setSelectedPrimarySubs([sub]);
    }
    // Remove any prior primary-sub tokens and insert the new one once
    setPrompt((prev) => {
      const subs = subNichesByPrimary[primary] || [];
      const toRemove = new Set(subs.map((s) => withPrimaryPrefix(primary, s).toLowerCase()));
      const parts = (prev || '').split(/\s*×\s*/).filter(Boolean);
      const filtered = parts.filter((p) => !toRemove.has(p.trim().toLowerCase()));
      const exists = filtered.some((p) => p.trim().toLowerCase() === label.toLowerCase());
      if (!exists) filtered.push(label);
      return filtered.join(' × ');
    });
    const nextDefaults: IdeogramDefaults = {
      aspect_ratio: preset.ideogram?.aspect_ratio ?? ideoAspect,
      rendering_speed: preset.ideogram?.rendering_speed ?? ideoSpeed,
      magic_prompt: preset.ideogram?.magic_prompt ?? ideoMagic,
      style_type: preset.ideogram?.style_type ?? ideoStyle,
      negative_prompt: preset.ideogram?.negative_prompt ?? (ideoNegative || undefined),
      seed: typeof preset.ideogram?.seed === 'number' ? preset.ideogram?.seed : (ideoSeed.trim() ? Number(ideoSeed) : undefined),
    } as const;
    if (preset.ideogram?.aspect_ratio) setIdeoAspect(preset.ideogram.aspect_ratio);
    if (preset.ideogram?.rendering_speed) setIdeoSpeed(preset.ideogram.rendering_speed);
    if (preset.ideogram?.magic_prompt) setIdeoMagic(preset.ideogram.magic_prompt);
    if (preset.ideogram?.style_type) setIdeoStyle(preset.ideogram.style_type);
    if (typeof preset.ideogram?.negative_prompt === 'string') setIdeoNegative(preset.ideogram.negative_prompt);
    if (typeof preset.ideogram?.seed === 'number') setIdeoSeed(String(preset.ideogram.seed));
    try { saveIdeogramDefaults(nextDefaults); } catch {}
    show({ title: 'Preset applied', description: `${primary} — ${sub}`, variant: 'success' });
  }

  async function handleFullRefresh() {
    setRefreshing(true);
    try {
      // 1) Clear server-side processed images
      try { await fetch('/api/workflow/clear-processed', { method: 'POST' }); } catch {}

      // 2) Clear local saved mockups and in-memory previews
      try { clearSavedMockups(); } catch {}
      setMockups({});
      setSelectedMockups({});

      // 3) Clear Workflow storage (localStorage + IndexedDB)
      try { clearWorkflowImages(); } catch {}
      try { await clearWorkflowImagesIndexedDB(); } catch {}

      // 4) Reset generator state
      setRows([]);
      setSelected({});
      setCopied({});
      setPrompt('');
      setSelectedPrimarySubs([]);
      setSecondaryNiche('');
      setSelectedSecondarySubs([]);
      setActivePreset(null);
      setActiveStyleDetails('');
      setTone('Auto');
      setTshirtStyle('Auto');
      setMockupGenerateCounts({});
      setSendSuccessCount({});

      show({ title: 'Refreshed', description: 'State and images cleared.', variant: 'success' });
    } finally {
      setRefreshing(false);
      setRefreshOpen(false);
    }
  }

  async function generateIdeas() {
    const p = effectivePrompt;
    if (!p) return;
    setIsLoading(true);
    beginFakeProgress(count || 1);
    try {
      // Resolve Auto selections by randomly picking a concrete tone/style
      const tonePool = TONE_OPTIONS.filter((t) => t !== 'Auto');
      const stylePool = STYLE_OPTIONS.filter((s) => s !== 'Auto');
      const chosenTone = (tone && tone !== 'Auto') ? tone : (tonePool[Math.floor(Math.random() * tonePool.length)] || 'Friendly');
      const chosenStyle = (tshirtStyle && tshirtStyle !== 'Auto') ? tshirtStyle : (stylePool[Math.floor(Math.random() * stylePool.length)] || 'Vintage Distressed');

      // Add chosen tone/style to the prompt text shown/saved
      let pWithMeta = p;
      const lower = p.toLowerCase();
      if (!lower.includes('tone — ') && chosenTone) {
        pWithMeta = pWithMeta ? `${pWithMeta} × Tone — ${chosenTone}` : `Tone — ${chosenTone}`;
      }
      if (!lower.includes('style — ') && chosenStyle) {
        pWithMeta = pWithMeta ? `${pWithMeta} × Style — ${chosenStyle}` : `Style — ${chosenStyle}`;
      }

      // If a custom style is chosen, append its detailed guidance to stabilize outputs
      if (STYLE_PROMPT_MAP[chosenStyle]) {
        pWithMeta = `${pWithMeta}\nStyle Details: ${STYLE_PROMPT_MAP[chosenStyle]}`;
      }

      // Also append details if the chosen style matches any user style by name/label
      if (chosenStyle && chosenStyle !== 'Auto' && userStyles.length > 0) {
        const lc = chosenStyle.toLowerCase();
        const match = userStyles.find(s => (s.name || '').toLowerCase() === lc || (s.label || '').toLowerCase() === lc);
        const det = (match?.details || '').trim();
        if (det) {
          const lowerMeta = pWithMeta.toLowerCase();
          if (!lowerMeta.includes(det.toLowerCase())) {
            pWithMeta = `${pWithMeta}\nStyle Details: ${det}`;
          }
        }
      }

      // Append selected user styles (generalized)
      if (selectedUserStyleIds.length > 0) {
        const byId: Record<string, UserStyle> = Object.fromEntries(userStyles.map(s => [s.id, s] as const));
        selectedUserStyleIds.forEach((id) => {
          const s = byId[id];
          if (!s) return;
          const label = (s.label || s.name || '').trim();
          if (label) {
            const lcl = label.toLowerCase();
            if (!pWithMeta.toLowerCase().includes(`style — ${lcl}`)) {
              pWithMeta = pWithMeta ? `${pWithMeta} × Style — ${label}` : `Style — ${label}`;
            }
          }
          const details = (s.details || '').trim();
          if (details) {
            pWithMeta = `${pWithMeta}\nStyle Details: ${details}`;
          }
        });
      }

      // Append active preset style details (if any) once
      {
        const det = (activeStyleDetails || '').trim();
        if (det) {
          const lowerMeta = pWithMeta.toLowerCase();
          if (!lowerMeta.includes(det.toLowerCase())) {
            pWithMeta = `${pWithMeta}\nStyle Details: ${det}`;
          }
        }
      }

      let res: Response;
      try {
        res = await fetch('/api/design-ideas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: noColons(pWithMeta),
            count: count || 1,
            model,
            tone: chosenTone,
            tshirtStyle: chosenStyle,
            primaryNiche: niche || '',
            secondaryNiche: secondaryNiche || '',
        }),
      });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        show({ title: 'Failed to fetch', description: 'Could not reach /api/design-ideas. Run the app via npm run dev/start (not file://). ' + msg, variant: 'error' });
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        try {
          const err = JSON.parse(text) as { error?: string };
          alert(err.error || text);
        } catch {
          alert(text);
        }
        return;
      }
      const data = await res.json() as { ideas: string[] };
      const now = Date.now();
      const next: DesignIdeaRow[] = data.ideas.map((desc, idx) => ({
        id: uid() + `-${idx}`,
        description: desc,
        prompt: pWithMeta,
        model,
        tags: [],
        status: 'pending',
        saved: false,
        createdAt: now + idx,
      }));
      setRows(prev => [...next, ...prev]);
      // save chosen model as default for convenience
      saveDefaultModel(model);
    } finally {
      setIsLoading(false);
      finishFakeProgress();
    }
  }

  // Sync sub-niches list when primary changes
  useEffect(() => {
    setSubNiches(subNichesByPrimary[niche] || []);
    setSelectedPrimarySubs([]);
  }, [niche, subNichesByPrimary]);

  // Persist niches/sub-niches list
  useEffect(() => {
    try { window.localStorage.setItem(NICHES_KEY, JSON.stringify(primaryNiches)); } catch {}
  }, [primaryNiches]);
  useEffect(() => {
    try { window.localStorage.setItem(SUB_NICHES_KEY, JSON.stringify(subNichesByPrimary)); } catch {}
  }, [subNichesByPrimary]);

  function buildMockupIdea(row: DesignIdeaRow): string {
    let base = (row.imagePrompt || '').trim();
    if (!base) base = row.description;
    const tone = (row.imgTone || '').trim();
    const style = (row.imgStyle || '').trim();
    const parts: string[] = [base];
    if (tone && tone !== 'Auto') parts.push(`Tone — ${tone}`);
    if (style && style !== 'Auto') parts.push(`Style — ${style}`);
    let idea = parts.join(' × ');
    if (style && STYLE_PROMPT_MAP[style]) {
      idea = `${idea}\nStyle Details: ${STYLE_PROMPT_MAP[style]}`;
    }
    const det = (activeStyleDetails || '').trim();
    if (det && !idea.toLowerCase().includes(det.toLowerCase())) {
      idea = `${idea}\nStyle Details: ${det}`;
    }
    return noColons(idea);
  }

  async function generateMockup(id: string, count: number = 1) {
    setMockupLoading(prev => ({ ...prev, [id]: true }));
    try {
      const row = rows.find(r => r.id === id);
      if (!row) throw new Error('Row not found');
      const idea = buildMockupIdea(row);
      type MockupIdeogramPayload = {
        idea: string;
        provider: 'ideogram';
        ideogram: {
          aspect_ratio?: IdeogramAspectRatio;
          rendering_speed?: IdeogramRenderingSpeed;
          magic_prompt?: IdeogramMagicPrompt;
          style_type?: IdeogramStyleType;
          negative_prompt?: string;
          seed?: number;
        };
      };
      type MockupORPayload = { idea: string; provider: 'openrouter'; model: string };
      const payload: (MockupIdeogramPayload & { count?: number }) | MockupORPayload = (mockupProvider === 'openrouter')
        ? { idea, provider: 'openrouter', model: mockupModel }
        : {
            idea,
            provider: 'ideogram',
            ideogram: {
              aspect_ratio: ideoAspect,
              rendering_speed: ideoSpeed,
              magic_prompt: ideoMagic,
              style_type: ideoStyle,
              negative_prompt: ideoNegative || undefined,
              seed: ideoSeed.trim() ? Number(ideoSeed) : undefined,
            },
            count: Math.max(1, Math.min(8, count || 1)),
          };

      const res = await fetch('/api/design-mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        try { const err = JSON.parse(text) as { error?: string }; alert(err.error || text); }
        catch { alert(text); }
        return;
      }
      const data = await res.json() as { images: string[] };
      setMockups(prev => {
        const existing = prev[id] || [];
        return { ...prev, [id]: [...existing, ...data.images] };
      });
    } finally {
      setMockupLoading(prev => ({ ...prev, [id]: false }));
    }
  }

  async function regenerateMockupAt(id: string, index: number) {
    setMockupLoading(prev => ({ ...prev, [id]: true }));
    try {
      const row = rows.find(r => r.id === id);
      if (!row) throw new Error('Row not found');
      const idea = buildMockupIdea(row);
      const payload = (mockupProvider === 'openrouter')
        ? { idea, provider: 'openrouter' as const, model: mockupModel }
        : {
            idea,
            provider: 'ideogram' as const,
            ideogram: {
              aspect_ratio: ideoAspect,
              rendering_speed: ideoSpeed,
              magic_prompt: ideoMagic,
              style_type: ideoStyle,
              negative_prompt: ideoNegative || undefined,
              seed: undefined,
            },
            count: 1,
          };
      const res = await fetch('/api/design-mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        try { const err = JSON.parse(text) as { error?: string }; alert(err.error || text); }
        catch { alert(text); }
        return;
      }
      const data = await res.json() as { images: string[] };
      const newImg = data.images?.[0];
      if (!newImg) return;
      setMockups(prev => {
        const arr = (prev[id] || []).slice();
        arr[index] = newImg;
        return { ...prev, [id]: arr };
      });
    } finally {
      setMockupLoading(prev => ({ ...prev, [id]: false }));
    }
  }

  // Utilities
  function sanitizeFilename(name: string): string {
    const cleaned = (name || 'Design').replace(/[^a-zA-Z0-9\s\-_]/g, '').replace(/\s+/g, '-');
    return cleaned.slice(0, 64) || 'Design';
  }
  async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const type = blob.type || 'image/png';
    return new File([blob], filename, { type });
  }
  async function sendImagesToWorkflow(idea: DesignIdeaRow, images: string[]): Promise<number> {
    const existing = await loadWorkflowImagesIndexedDB();
    const now = Date.now();
    const baseName = sanitizeFilename(idea.description.slice(0, 40));
    const newOnes: WorkflowImage[] = [];
    let i = 0;
    for (const img of images) {
      i += 1;
      const fname = `${baseName || 'Design'}-${String(i).padStart(2, '0')}.png`;
      const file = await dataUrlToFile(img, fname);
      const wf: WorkflowImage = {
        id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
        originalFile: file,
        status: 'pending',
        metadata: {
          brand: '',
          // Do not pre-fill title; user will set it in Workflow
          keywords: '',
          bullet1: '',
          bullet2: '',
          description: '',
        },
        processingSteps: { generated: true },
      };
      newOnes.push(wf);
    }
    await saveWorkflowImagesIndexedDB([...existing, ...newOnes]);
    return newOnes.length;
  }
  async function sendOneToWorkflow(idea: DesignIdeaRow, image: string) {
    setSendingToWorkflow((p) => ({ ...p, [idea.id]: true }));
    try {
      const count = await sendImagesToWorkflow(idea, [image]);
      setSendSuccessCount((p) => ({ ...p, [idea.id]: (p[idea.id] || 0) + count }));
      show({ title: 'Sent to Workflow', description: 'Design added to Workflow.', variant: 'success' });
    } finally {
      setSendingToWorkflow((p) => ({ ...p, [idea.id]: false }));
    }
  }
  async function sendSelectedToWorkflow(idea: DesignIdeaRow) {
    const selected = selectedMockups[idea.id] || [];
    if (selected.length === 0) return;
    setSendingToWorkflow((p) => ({ ...p, [idea.id]: true }));
    try {
      const count = await sendImagesToWorkflow(idea, selected);
      setSendSuccessCount((p) => ({ ...p, [idea.id]: (p[idea.id] || 0) + count }));
      show({ title: 'Sent to Workflow', description: `Added ${count} design(s).`, variant: 'success' });
    } finally {
      setSendingToWorkflow((p) => ({ ...p, [idea.id]: false }));
    }
  }

  function toggleComplete(id: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: r.status === 'completed' ? 'pending' : 'completed' } : r));
  }
  async function completeAndMoveToWF(idea: DesignIdeaRow) {
    // Mark complete
    toggleComplete(idea.id);
    // Prefer sending saved previews, else first generated preview if any
    const saved = selectedMockups[idea.id] || [];
    if (saved.length > 0) {
      await sendSelectedToWorkflow(idea);
      return;
    }
    const gen = mockups[idea.id] || [];
    if (gen.length > 0) {
      await sendOneToWorkflow(idea, gen[0]!);
      return;
    }
    // No previews available
    show({ title: 'No previews to move', description: 'Generate or save a preview first.', variant: 'info' });
  }
  function toggleSave(id: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, saved: !r.saved } : r));
  }
  function updateTags(id: string, tags: string[]) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, tags } : r));
  }
  function deleteRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id));
    setSelected(prev => {
      const next = { ...prev }; delete next[id]; return next;
    });
  }
  async function copyRow(desc: string, id: string) {
    try {
      await navigator.clipboard.writeText(desc);
      setCopied(prev => ({ ...prev, [id]: true }));
      window.setTimeout(() => {
        setCopied(prev => ({ ...prev, [id]: false }));
      }, 1200);
    } catch {}
  }

  // Bulk
  const anySelected = useMemo(() => Object.values(selected).some(Boolean), [selected]);
  function toggleSelect(id: string) {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  }
  function selectAllVisible() {
    const map: Record<string, boolean> = {};
    filteredSortedRows.forEach(r => { map[r.id] = true; });
    setSelected(map);
  }
  function clearSelection() { setSelected({}); }
  function bulkDelete() {
    const ids = new Set(Object.entries(selected).filter(([, v]) => v).map(([k]) => k));
    setRows(prev => prev.filter(r => !ids.has(r.id)));
    setSelected({});
  }
  function bulkComplete() {
    const ids = new Set(Object.entries(selected).filter(([, v]) => v).map(([k]) => k));
    setRows(prev => prev.map(r => ids.has(r.id) ? { ...r, status: 'completed' } : r));
    setSelected({});
  }
  // Bulk mockup generation
  const [bulkGenerateCount, setBulkGenerateCount] = useState<number>(1);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  async function bulkGenerateMockups() {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) return;
    setBulkGenerating(true);
    try {
      // Run sequentially to avoid rate-limits
      for (const id of ids) {
        // eslint-disable-next-line no-await-in-loop
        await generateMockup(id, Math.max(1, Math.min(8, bulkGenerateCount || 1)));
      }
      show({ title: 'Generation started', description: `Requested ${Math.max(1, Math.min(8, bulkGenerateCount || 1))} per ${ids.length} idea(s).`, variant: 'success' });
    } finally {
      setBulkGenerating(false);
    }
  }

  return (
    <main className={cn(
      "space-y-6 transition-all duration-500 ease-out",
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    )}>
      <Card className={cn(
        "transition-all duration-500 ease-out delay-100",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">Design Generator</CardTitle>
              <p className="text-muted-foreground">Enter a creative prompt, choose a model, and generate multiple text-only design ideas suitable for Ideogram.</p>
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full" title="Generation settings" aria-label="Generation settings">
                  <Settings className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Generation Settings</SheetTitle>
                  <SheetDescription>Pick models and defaults used for generating ideas and mockups.</SheetDescription>
                </SheetHeader>
                <div className="p-4 pt-0 space-y-4">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-gray-600">Text model</span>
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEFAULT_MODELS.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <div className="flex gap-2 items-center">
                    <Button
                      variant={modelSaveState === 'saved' ? 'default' : 'outline'}
                      size="sm"
                      disabled={modelSaveState === 'saving'}
                      onClick={() => {
                        setModelSaveState('saving');
                        try {
                          saveDefaultModel(model);
                          show({ title: 'Default model saved', variant: 'success' });
                          setModelSaveState('saved');
                          setTimeout(() => setModelSaveState('idle'), 1500);
                        } catch {
                          setModelSaveState('idle');
                        }
                      }}
                      title="Save as default model"
                    >
                      {modelSaveState === 'saving' ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin"/>Saving…
                        </>
                      ) : modelSaveState === 'saved' ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2"/>Saved
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2"/>Save default
                        </>
                      )}
                    </Button>
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-gray-600">Mockup provider</span>
                    <Select value={mockupProvider} onValueChange={(v: MockupProvider) => { setMockupProvider(v); saveMockupProvider(v); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ideogram">Ideogram (default)</SelectItem>
                        <SelectItem value="openrouter">OpenRouter (fallback)</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-gray-600">{mockupProvider === 'openrouter' ? 'Mockup model' : 'Ideogram settings'}</span>
                    {mockupProvider === 'openrouter' ? (
                    <Select value={mockupModel} onValueChange={setMockupModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select image model" />
                      </SelectTrigger>
                      <SelectContent>
                        {IMAGE_MODELS.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <span className="text-xs text-gray-500">Preview generates 1 image</span>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Aspect ratio</span>
                          <Select value={ideoAspect} onValueChange={(v) => setIdeoAspect(v as IdeogramAspectRatio)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Aspect ratio" />
                            </SelectTrigger>
                            <SelectContent>
                              {['1x1','5x4','4x5','3x4','4x3','3x2','2x3','16x9','9x16','2x1','1x2','3x1','1x3','16x10','10x16'].map(a => (
                                <SelectItem key={a} value={a}>{a}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Rendering speed</span>
                          <Select value={ideoSpeed} onValueChange={(v) => setIdeoSpeed(v as IdeogramRenderingSpeed)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Rendering speed" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="TURBO">TURBO</SelectItem>
                              <SelectItem value="DEFAULT">DEFAULT</SelectItem>
                              <SelectItem value="QUALITY">QUALITY</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Magic prompt</span>
                          <Select value={ideoMagic} onValueChange={(v) => setIdeoMagic(v as IdeogramMagicPrompt)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Magic prompt" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AUTO">AUTO</SelectItem>
                              <SelectItem value="ON">ON</SelectItem>
                              <SelectItem value="OFF">OFF</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Style</span>
                          <Select value={ideoStyle} onValueChange={(v) => setIdeoStyle(v as IdeogramStyleType)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Style" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AUTO">AUTO</SelectItem>
                              <SelectItem value="GENERAL">GENERAL</SelectItem>
                              <SelectItem value="REALISTIC">REALISTIC</SelectItem>
                              <SelectItem value="DESIGN">DESIGN</SelectItem>
                              <SelectItem value="FICTION">FICTION</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2">
                          <span className="text-xs text-gray-500">Negative prompt</span>
                          <Input value={ideoNegative} onChange={(e) => setIdeoNegative(e.target.value)} placeholder="What to avoid" />
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Seed (optional)</span>
                          <Input value={ideoSeed} onChange={(e) => setIdeoSeed(e.target.value.replace(/[^0-9]/g, ''))} placeholder="random" />
                        </div>
                        <div className="col-span-2 flex gap-2 mt-1 items-center">
                          <Button
                            variant={ideogramSaveState === 'saved' ? 'default' : 'outline'}
                            size="sm"
                            disabled={ideogramSaveState === 'saving'}
                            onClick={() => {
                              setIdeogramSaveState('saving');
                              try {
                                saveMockupProvider('ideogram');
                                saveIdeogramDefaults({
                                  aspect_ratio: ideoAspect,
                                  rendering_speed: ideoSpeed,
                                  magic_prompt: ideoMagic,
                                  style_type: ideoStyle,
                                  negative_prompt: ideoNegative || undefined,
                                  seed: ideoSeed.trim() ? Number(ideoSeed) : undefined,
                                });
                                show({ title: 'Ideogram defaults saved', variant: 'success' });
                                setIdeogramSaveState('saved');
                                setTimeout(() => setIdeogramSaveState('idle'), 1500);
                              } catch {
                                setIdeogramSaveState('idle');
                              }
                            }}
                            title="Save Ideogram defaults"
                          >
                            {ideogramSaveState === 'saving' ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin"/>Saving…
                              </>
                            ) : ideogramSaveState === 'saved' ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-2"/>Saved
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2"/>Save Ideogram defaults
                              </>
                            )}
                          </Button>
                          {ideogramSaveState === 'saved' && (
                            <span className="text-xs text-green-700">Saved!</span>
                          )}
                        </div>
                      </div>
                    )}
                  </label>
                  {/* Workflow Upscale Settings */}
                  <div className="space-y-3 pt-2 mt-2 border-t">
                    <div className="text-sm text-gray-600">Workflow Upscale</div>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500">Upscale provider</span>
                      <Select value={upscaleProvider} onValueChange={(v: UpscaleProvider) => { setUpscaleProvider(v); saveUpscaleProvider(v); }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ideogram">Ideogram Upscale (default)</SelectItem>
                          <SelectItem value="upscayl">Upscayl</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                    {upscaleProvider === 'ideogram' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <span className="text-xs text-gray-500">Resemblance: {upResemblance}</span>
                          <Slider min={1} max={100} value={[upResemblance]} onValueChange={(v) => setUpResemblance(Number(v?.[0] ?? 50))} />
                        </div>
                        <div className="col-span-2">
                          <span className="text-xs text-gray-500">Detail: {upDetail}</span>
                          <Slider min={1} max={100} value={[upDetail]} onValueChange={(v) => setUpDetail(Number(v?.[0] ?? 50))} />
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Magic prompt</span>
                          <Select value={upMagic} onValueChange={(v) => setUpMagic(v as 'AUTO'|'ON'|'OFF')}>
                            <SelectTrigger>
                              <SelectValue placeholder="Magic prompt" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AUTO">AUTO</SelectItem>
                              <SelectItem value="ON">ON</SelectItem>
                              <SelectItem value="OFF">OFF</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Seed (optional)</span>
                          <Input value={upSeed} onChange={(e) => setUpSeed(e.target.value.replace(/[^0-9]/g, ''))} placeholder="random" />
                        </div>
                        <div className="col-span-2">
                          <Button variant="outline" size="sm" onClick={() => {
                            saveUpscaleProvider(upscaleProvider);
                            saveIdeogramUpscaleSettings({
                              resemblance: upResemblance,
                              detail: upDetail,
                              magic_prompt_option: upMagic,
                              seed: upSeed.trim() ? Number(upSeed) : undefined,
                            });
                            show({ title: 'Upscale settings saved', variant: 'success' });
                          }}>Save Upscale Settings</Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* My Styles (general) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">My Styles</span>
                      <Button variant="outline" size="sm" onClick={() => setShowStylesManager(true)}>Manage</Button>
                    </div>
                    {userStyles.length === 0 && (
                      <div className="text-xs text-gray-500">No custom styles yet. Click Manage to add.</div>
                    )}
                    {userStyles.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {userStyles.map((s) => {
                          const active = selectedUserStyleIds.includes(s.id);
                          return (
                            <Button key={s.id} type="button" size="sm" variant={active ? 'default' : 'outline'} onClick={() => {
                              setSelectedUserStyleIds((prev) => active ? prev.filter(id => id !== s.id) : [...prev, s.id]);
                            }} title={s.details || s.label || s.name}>
                              {s.label || s.name}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-2 sm:col-span-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-600">Preset</span>
                <Select
                  value={(activePreset?.primary === 'Christian' ? (activePreset?.sub || 'none') : 'none')}
                  onValueChange={(v) => {
                    if (v === 'none') {
                      setActivePreset(null);
                      setActiveStyleDetails('');
                      // Also remove any previously injected Christian sub‑niche from prompt
                      setPrompt((prev) => {
                        const subs = subNichesByPrimary['Christian'] || [];
                        const toRemove = new Set(subs.map((s) => withPrimaryPrefix('Christian', s).toLowerCase()));
                        const parts = (prev || '').split(/\s*×\s*/).filter(Boolean);
                        const filtered = parts.filter((p) => !toRemove.has(p.trim().toLowerCase()));
                        return filtered.join(' × ');
                      });
                      setSelectedPrimarySubs([]);
                      return;
                    }
                    applyPreset('Christian', v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a preset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(() => {
                      const items = (subNichesByPrimary['Christian'] || []).filter(s => !!getNichePreset('Christian', s));
                      return items.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>));
                    })()}
                  </SelectContent>
                </Select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-600">Prompt</span>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., Christian women’s tees with floral themes"
                  className="min-h-24"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Primary niche</span>
              <Select value={niche} onValueChange={setNiche}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a niche" />
                </SelectTrigger>
                <SelectContent>
                  {primaryNiches.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Optional add-new primary input retained; hidden for cleaner layout */}
            </label>
            <label className="flex flex-col gap-1 sm:col-span-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Sub-niches for {niche || '—'}</span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPrimarySubs([])} disabled={selectedPrimarySubs.length === 0}>Clear</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {!niche && (
                  <span className="text-xs text-gray-500">Select a primary niche first</span>
                )}
                {niche && subNiches.length === 0 && (
                  <span className="text-xs text-gray-500">No sub-niches configured</span>
                )}
                {niche && subNiches.map((t) => (
                  <Button
                    key={t}
                    variant={selectedPrimarySubs.includes(t) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const willAdd = !selectedPrimarySubs.includes(t);
                      setSelectedPrimarySubs((prev) => willAdd ? [...prev, t] : prev.filter(x => x !== t));
                      const label = withPrimaryPrefix(niche, t);
                      if (willAdd) appendToPrompt(label); else removeFromPrompt(label);
                    }}
                    title={`Toggle ${t}`}
                  >
                    {t}
                  </Button>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Selected sub‑niches for {niche || '—'} will be combined with the prompt on generate.</span>
              </div>
            </label>

            {/* Secondary (cross‑niche) controls */}
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Secondary primary niche</span>
              <Select value={secondaryNiche} onValueChange={(v) => {
                const prev = secondaryNiche;
                setSecondaryNiche(v);
                setSelectedSecondarySubs([]);
                setPrompt((prevPrompt) => {
                  const parts = (prevPrompt || '').split(/\s*×\s*/).filter(Boolean);
                  const toRemove = new Set<string>();
                  if (prev) {
                    toRemove.add(prev.toLowerCase());
                    const prevSubs = subNichesByPrimary[prev] || [];
                    prevSubs.forEach((s) => toRemove.add(withPrimaryPrefix(prev, s).toLowerCase()));
                  }
                  const filtered = parts.filter((p) => !toRemove.has(p.trim().toLowerCase()));
                  if (v && !filtered.some((p) => p.trim().toLowerCase() === v.toLowerCase())) {
                    filtered.push(v);
                  }
                  return filtered.join(' × ');
                });
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a secondary niche" />
                </SelectTrigger>
                <SelectContent>
                  {primaryNiches.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1 sm:col-span-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Sub‑niches for {secondaryNiche || '—'} (secondary)</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPrompt((prevPrompt) => {
                      const parts = (prevPrompt || '').split(/\s*×\s*/).filter(Boolean);
                      const toRemove = new Set((selectedSecondarySubs || []).map((s) => withPrimaryPrefix(secondaryNiche, s).toLowerCase()));
                      const filtered = parts.filter((p) => !toRemove.has(p.trim().toLowerCase()));
                      if (secondaryNiche && !filtered.some((p) => p.trim().toLowerCase() === secondaryNiche.toLowerCase())) {
                        filtered.push(secondaryNiche);
                      }
                      return filtered.join(' × ');
                    });
                    setSelectedSecondarySubs([]);
                  }}
                  disabled={!secondaryNiche || selectedSecondarySubs.length === 0}
                >
                  Clear
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {!secondaryNiche && (
                  <span className="text-xs text-gray-500">Select a secondary primary niche</span>
                )}
                {secondaryNiche && secondarySubs.length === 0 && (
                  <span className="text-xs text-gray-500">No sub-niches configured</span>
                )}
                {secondaryNiche && secondarySubs.map((t) => (
                  <Button
                    key={t}
                    variant={selectedSecondarySubs.includes(t) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const willAdd = !selectedSecondarySubs.includes(t);
                      setSelectedSecondarySubs((prev) => willAdd ? [...prev, t] : prev.filter(x => x !== t));
                      const label = withPrimaryPrefix(secondaryNiche, t);
                      if (willAdd) {
                        setPrompt((prevPrompt) => {
                          const parts = (prevPrompt || '').split(/\s*×\s*/).filter(Boolean);
                          const existsPrimary = parts.some((p) => p.trim().toLowerCase() === secondaryNiche.toLowerCase());
                          if (secondaryNiche && !existsPrimary) parts.push(secondaryNiche);
                          const existsSub = parts.some((p) => p.trim().toLowerCase() === label.toLowerCase());
                          if (!existsSub) parts.push(label);
                          return parts.join(' × ');
                        });
                      } else {
                        removeFromPrompt(label);
                      }
                    }}
                    title={`Toggle ${t}`}
                  >
                    {t}
                  </Button>
                ))}
              </div>
              <span className="text-xs text-gray-500">Selected secondary sub‑niches will be combined with the prompt on generate.</span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">How many ideas?</span>
              <Input
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value || 1))))}
                placeholder="5"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Tone</span>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a tone" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    'Auto',
                    'Funny',
                    'Sarcastic',
                    'Inspirational',
                    'Playful',
                    'Minimalist',
                    'Vintage',
                    'Gothic',
                    'Bold',
                    'Elegant',
                    'Professional',
                    'Friendly',
                    'Edgy',
                    'Youthful',
                    'Feminine',
                    'Masculine',
                  ].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">T‑shirt Style</span>
              <Select value={tshirtStyle} onValueChange={setTshirtStyle}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a style" />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const base = [
                      'Auto',
                      'Vintage Distressed',
                      'Bold Sans Typography',
                      'Minimalist Line Art',
                      'Hand‑Lettered Script',
                      'Retro 70s',
                      'Anime Manga',
                      'Kawaii Chibi',
                      'Cartoon Mascot',
                      'Pop Art',
                      'Grunge Streetwear',
                      'Y2K',
                      'Sports Jersey',
                      'Gothic Blackletter',
                      'Sticker Style',
                      'Graffiti',
                      'Tattoo Old School',
                      'Cyberpunk',
                      'Halftone',
                      'Psychedelic',
                    ];
                    const extras = (userStyles || [])
                      .map(s => (s?.name || s?.label || '').trim())
                      .filter(Boolean);
                    const merged: string[] = [];
                    const seen = new Set<string>();
                    [...base, ...extras].forEach((s) => {
                      const key = s.toLowerCase();
                      if (!seen.has(key)) { seen.add(key); merged.push(s); }
                    });
                    return merged.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
            </label>

            
            
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={generateIdeas} disabled={isLoading || !effectivePrompt.trim()}>
              {isLoading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Generating…</>) : 'Generate'}
            </Button>
            <Button type="button" variant="outline" onClick={randomizeSecondary} title="Pick a random secondary niche + sub‑niche">
              <Shuffle className="h-4 w-4 mr-2"/> Randomizer
            </Button>
            <Button type="button" variant="outline" onClick={superRandomize} title="Pick random primary + sub‑niche and secondary + sub‑niche">
              <Dice5 className="h-4 w-4 mr-2"/> Super Randomizer
            </Button>
            {/* Full Refresh at far right */}
            <Dialog open={refreshOpen} onOpenChange={setRefreshOpen}>
              <Button
                type="button"
                variant="destructive"
                className="ml-auto"
                onClick={() => setRefreshOpen(true)}
                title="Full refresh: clears generated previews and workflow images"
                aria-label="Full refresh"
              >
                <RefreshIcon className="h-4 w-4 mr-2" /> Full Refresh
              </Button>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Full Refresh</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>This resets the Design Generator, clears generated previews and saved mockups, clears Workflow images (local storage and IndexedDB), and deletes processed images on the server.</p>
                  <p>Are you sure you want to continue?</p>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setRefreshOpen(false)} disabled={refreshing}>Cancel</Button>
                  <Button variant="destructive" onClick={handleFullRefresh} disabled={refreshing}>
                    {refreshing ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Refreshing…</>) : 'Confirm Refresh'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {progressVisible && (
            <div className="mt-3">
              <div className="h-1.5 w-full rounded bg-gray-200 overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-[width] duration-150 ease-out"
                  style={{ width: `${Math.max(0, Math.min(100, progressPct))}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-gray-600">Generating… {Math.round(progressPct)}%</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn(
        "transition-all duration-500 ease-out delay-150",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}>
        <CardHeader>
          <CardTitle className="text-lg">Ideas</CardTitle>
          <div className="grid sm:grid-cols-4 gap-2 mt-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600">Sort by</span>
              <Select value={sortKey} onValueChange={(v: SortKey) => setSortKey(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_desc">Date (newest)</SelectItem>
                  <SelectItem value="date_asc">Date (oldest)</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="model">Model</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600">Filter</span>
              <Select value={filterMode} onValueChange={(v: FilterMode) => setFilterMode(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="saved">Saved</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600">Model</span>
              <Select value={filterModel} onValueChange={setFilterModel}>
                <SelectTrigger><SelectValue placeholder="All models" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All models</SelectItem>
                  {modelsInData.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1 sm:col-span-1">
              <span className="text-xs text-gray-600">Filter tags</span>
              <TagInput value={filterTags} onChange={setFilterTags} placeholder="tag,another" />
            </label>
          </div>

          {filteredSortedRows.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {!anySelected ? (
                <>
                  <Button variant="outline" onClick={selectAllVisible}>Select all</Button>
                  <Button variant="outline" onClick={clearSelection}>Clear selection</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={bulkComplete}><CheckCircle2 className="h-4 w-4 mr-2"/>Mark completed</Button>
                  <Button variant="destructive" onClick={bulkDelete}><Trash2 className="h-4 w-4 mr-2"/>Delete selected</Button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Generate</span>
                    <Input
                      type="number"
                      min={1}
                      max={8}
                      className="w-16 h-8 text-sm"
                      value={bulkGenerateCount}
                      onChange={(e) => setBulkGenerateCount(Math.max(1, Math.min(8, Number(e.target.value || 1))))}
                    />
                    <Button
                      variant="outline"
                      onClick={bulkGenerateMockups}
                      disabled={bulkGenerating}
                      title="Generate mockups for all selected ideas"
                    >
                      {bulkGenerating ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Generating</>) : (<><ImageIcon className="h-4 w-4 mr-2"/>Generate selected</>)}
                    </Button>
                  </div>
                  <Button variant="outline" onClick={clearSelection}>Clear selection</Button>
                </>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredSortedRows.map((r) => (
            <div key={r.id} className="border rounded-md p-4 bg-white transition-all duration-200 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={!!selected[r.id]} onChange={() => toggleSelect(r.id)} />
                  {r.status === 'completed' ? (
                    <span className="inline-flex items-center text-green-700 text-sm">
                      <CheckCircle2 className="h-4 w-4 mr-1"/> Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-gray-500 text-sm">
                      <Circle className="h-4 w-4 mr-1"/> Pending
                    </span>
                  )}
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.model}</code>
                  {r.saved && (
                    <span className="text-xs text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">Saved</span>
                  )}
                </div>
                <div className="text-[11px] text-gray-400 whitespace-nowrap flex items-center gap-2 relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    title={promptEditOpen[r.id] ? 'Hide prompt editor' : 'Edit mockup prompt'}
                    onClick={() => {
                      setPromptEditOpen(prev => {
                        const nextOpen = !prev[r.id];
                        // Initialize drafts when opening
                        if (nextOpen) {
                          setPromptEditMode(m => ({ ...m, [r.id]: m[r.id] || 'both' }));
                          setPromptDraft(d => ({ ...d, [r.id]: (r.imagePrompt ?? r.description) }));
                          const parsed = parseToneStyleFromPrompt(r.prompt || '');
                          setToneDraft(d => ({ ...d, [r.id]: (r.imgTone ?? parsed.tone ?? 'Auto') }));
                          setStyleDraft(d => ({ ...d, [r.id]: (r.imgStyle ?? parsed.style ?? 'Auto') }));
                        }
                        return { ...prev, [r.id]: nextOpen };
                      });
                    }}
                  >
                    <EditIcon className="h-4 w-4" />
                  </Button>
                  <span>{new Date(r.createdAt).toLocaleString()}</span>

                  {promptEditOpen[r.id] && (
                    <div className="absolute top-7 right-0 z-50 w-80 bg-white border rounded-md shadow-lg p-3 text-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Edit Mode</span>
                        <Button variant="ghost" size="icon" onClick={() => setPromptEditOpen(prev => ({ ...prev, [r.id]: false }))} title="Close">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        {(['prompt','toneStyle','both'] as const).map(mode => (
                          <Button
                            key={mode}
                            variant={(promptEditMode[r.id] || 'both') === mode ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPromptEditMode(m => ({ ...m, [r.id]: mode }))}
                          >
                            {mode === 'prompt' ? 'Prompt' : mode === 'toneStyle' ? 'Tone & Style' : 'Both'}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-2 text-sm whitespace-pre-wrap leading-snug">
                {r.description}
              </div>

              <div className="mt-2 text-xs text-gray-600">
                <span className="font-medium">Prompt:</span>{' '}
                <span title={r.prompt} className="align-middle">{r.prompt.length > 160 ? r.prompt.slice(0, 160) + '…' : r.prompt}</span>
              </div>

              {(r.imagePrompt || r.imgTone || r.imgStyle) && (
                <div className="mt-1 text-xs text-gray-600">
                  <span className="font-medium">Mockup:</span>{' '}
                  <span
                    title={(r.imagePrompt ?? r.description) || ''}
                    className="align-middle"
                  >
                    {(r.imagePrompt ?? r.description).length > 160
                      ? (r.imagePrompt ?? r.description).slice(0, 160) + '…'
                      : (r.imagePrompt ?? r.description)}
                  </span>
                  <span className="ml-2 opacity-80">Tone: {r.imgTone ?? 'Auto'}</span>
                  <span className="ml-2 opacity-80">Style: {r.imgStyle ?? 'Auto'}</span>
                </div>
              )}

              <div className="mt-3">
                <TagInput value={r.tags} onChange={(tags) => updateTags(r.id, tags)} placeholder="add,tag" />
              </div>
              {/* Inline editing on the card when edit mode is open */}
              {promptEditOpen[r.id] && (
                <div className="mt-3">
                  {(promptEditMode[r.id] === 'prompt' || promptEditMode[r.id] === 'both' || !promptEditMode[r.id]) && (
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-gray-600">Mockup Prompt</span>
                      <Textarea
                        value={promptDraft[r.id] ?? (r.imagePrompt ?? r.description)}
                        onChange={(e) => setPromptDraft(d => ({ ...d, [r.id]: e.target.value }))}
                        className="min-h-20"
                      />
                      <div className="text-[11px] text-gray-500">Overrides the text sent to Ideogram for this idea only.</div>
                    </label>
                  )}
                  {(promptEditMode[r.id] === 'toneStyle' || promptEditMode[r.id] === 'both' || !promptEditMode[r.id]) && (
                    <div className="mt-2 grid sm:grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-gray-600">Tone</span>
                        <Select value={toneDraft[r.id] ?? (r.imgTone ?? 'Auto')} onValueChange={(v) => setToneDraft(d => ({ ...d, [r.id]: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TONE_OPTIONS.map(t => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-gray-600">Style</span>
                        <Select value={styleDraft[r.id] ?? (r.imgStyle ?? 'Auto')} onValueChange={(v) => setStyleDraft(d => ({ ...d, [r.id]: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STYLE_OPTIONS.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </label>
                    </div>
                  )}
                  <div className="mt-2 flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setPromptEditOpen(prev => ({ ...prev, [r.id]: false }))}>Cancel</Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        const mode = promptEditMode[r.id] || 'both';
                        setRows(prev => prev.map(row => {
                          if (row.id !== r.id) return row;
                          const next = { ...row } as DesignIdeaRow;
                          if (mode === 'prompt' || mode === 'both') {
                            const newText = promptDraft[r.id] ?? (row.imagePrompt ?? row.description);
                            next.imagePrompt = newText;
                            // Also update the visible idea text so the card reflects edits
                            next.description = newText;
                          }
                          if (mode === 'toneStyle' || mode === 'both') {
                            next.imgTone = toneDraft[r.id] ?? (row.imgTone ?? 'Auto');
                            next.imgStyle = styleDraft[r.id] ?? (row.imgStyle ?? 'Auto');
                          }
                          return next;
                        }));
                        setPromptEditOpen(prev => ({ ...prev, [r.id]: false }));
                        show({ title: 'Mockup settings saved', variant: 'success' });
                      }}
                    >Save</Button>
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2 justify-between items-center">
                <div className="flex items-center gap-3">
                  {Array.isArray(mockups[r.id]) && mockups[r.id].length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {mockups[r.id].map((src, idx) => (
                          <div key={idx} className="relative">
                            <button
                              className="absolute -top-2 -left-2 bg-white/90 hover:bg-white text-yellow-600 border rounded-full w-6 h-6 flex items-center justify-center z-10"
                              title={(selectedMockups[r.id] || []).includes(src) ? 'Unselect' : 'Select'}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMockups(prev => {
                                  const cur = new Set(prev[r.id] || []);
                                  if (cur.has(src)) cur.delete(src); else cur.add(src);
                                  const next = { ...prev, [r.id]: Array.from(cur) };
                                  saveSavedMockups(next);
                                  return next;
                                });
                              }}
                            >
                              <Star className={`h-4 w-4 ${ (selectedMockups[r.id] || []).includes(src) ? '' : 'opacity-30' }`} />
                            </button>
                            <button
                              className="group relative w-24 h-24 border rounded overflow-hidden bg-gray-100"
                              onClick={() => { setPreviewOpenId(r.id); setPreviewOpenIndex(idx); }}
                              title="Open preview"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={src} alt={`Mockup ${idx+1}`} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                <Maximize2 className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </button>
                            <button
                              className="absolute bottom-1 left-1 bg-white/90 hover:bg-white text-blue-700 border rounded px-1.5 py-0.5 text-[10px] flex items-center gap-1"
                              title="Send to Workflow"
                              onClick={(e) => { e.stopPropagation(); sendOneToWorkflow(r, src); }}
                              disabled={!!sendingToWorkflow[r.id]}
                            >
                              {sendingToWorkflow[r.id] ? <Loader2 className="h-3 w-3 animate-spin"/> : <UploadIcon className="h-3 w-3"/>}
                              To WF
                            </button>
                            <button
                              className="absolute bottom-1 right-1 bg-white/90 hover:bg-white text-gray-700 border rounded px-1.5 py-0.5 text-[10px] flex items-center gap-1"
                              title="Regenerate this preview"
                              onClick={(e) => { e.stopPropagation(); regenerateMockupAt(r.id, idx); }}
                              disabled={!!mockupLoading[r.id]}
                            >
                              {mockupLoading[r.id] ? <Loader2 className="h-3 w-3 animate-spin"/> : <RefreshIcon className="h-3 w-3"/>}
                              Regen
                            </button>
                            <button
                              className="absolute -top-2 -right-2 bg-white/90 hover:bg-white text-red-600 border rounded-full w-6 h-6 flex items-center justify-center"
                              title="Delete this preview"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMockups(prev => {
                                  const arr = (prev[r.id] || []).slice();
                                  const removed = arr.splice(idx, 1)[0];
                                  const next = { ...prev, [r.id]: arr };
                                  return next;
                                });
                                // Remove from saved if present
                                setSelectedMockups(prev => {
                                  const setArr = new Set(prev[r.id] || []);
                                  setArr.delete(src);
                                  const next = { ...prev, [r.id]: Array.from(setArr) };
                                  saveSavedMockups(next);
                                  return next;
                                });
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                      {/* Single dialog per row with navigation */}
                      <Dialog open={previewOpenId === r.id} onOpenChange={(open) => setPreviewOpenId(open ? r.id : null)}>
                        <div className="hidden" />
                        {previewOpenId === r.id && (
                          <DialogContent className="sm:max-w-3xl">
                            <DialogHeader>
                              <DialogTitle>Mockup Preview</DialogTitle>
                            </DialogHeader>
                            <div className="relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={mockups[r.id][previewOpenIndex] || ''} alt={`Mockup large ${previewOpenIndex+1}`} className="w-full h-auto rounded" />
                              <button
                                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white border rounded-full w-8 h-8 flex items-center justify-center"
                                onClick={() => {
                                  const len = (mockups[r.id] || []).length;
                                  if (len === 0) return;
                                  setPreviewOpenIndex((prev) => (prev + len - 1) % len);
                                }}
                                aria-label="Previous"
                              >
                                <ChevronLeft className="h-5 w-5" />
                              </button>
                              <button
                                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white border rounded-full w-8 h-8 flex items-center justify-center"
                                onClick={() => {
                                  const len = (mockups[r.id] || []).length;
                                  if (len === 0) return;
                                  setPreviewOpenIndex((prev) => (prev + 1) % len);
                                }}
                                aria-label="Next"
                              >
                                <ChevronRight className="h-5 w-5" />
                              </button>
                              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                                {(previewOpenIndex + 1)} / {(mockups[r.id] || []).length}
                              </div>
                              <div className="absolute top-2 right-10 flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const curSrc = mockups[r.id][previewOpenIndex];
                                    setSelectedMockups(prev => {
                                      const setArr = new Set(prev[r.id] || []);
                                      if (setArr.has(curSrc)) setArr.delete(curSrc); else setArr.add(curSrc);
                                      const next = { ...prev, [r.id]: Array.from(setArr) };
                                      saveSavedMockups(next);
                                      return next;
                                    });
                                  }}
                                  title="Toggle select"
                                >
                                  <Star className={`h-4 w-4 mr-1 ${ (selectedMockups[r.id] || []).includes(mockups[r.id][previewOpenIndex]) ? '' : 'opacity-30' }`} />
                                  Select
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const curSrc = mockups[r.id][previewOpenIndex];
                                    sendOneToWorkflow(r, curSrc);
                                  }}
                                  disabled={!!sendingToWorkflow[r.id]}
                                  title="Send to Workflow"
                                >
                                  {sendingToWorkflow[r.id] ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <UploadIcon className="h-4 w-4 mr-2"/>}
                                  To Workflow
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    const idx = previewOpenIndex;
                                    const toDelete = mockups[r.id][idx];
                                    setMockups(prev => {
                                      const arr = (prev[r.id] || []).slice();
                                      arr.splice(idx, 1);
                                      const next = { ...prev, [r.id]: arr };
                                      const len = arr.length;
                                      setPreviewOpenIndex((p) => Math.max(0, Math.min(p, Math.max(0, len - 1))));
                                      if (len === 0) setPreviewOpenId(null);
                                      return next;
                                    });
                                    setSelectedMockups(prev => {
                                      const setArr = new Set(prev[r.id] || []);
                                      setArr.delete(toDelete);
                                      const next = { ...prev, [r.id]: Array.from(setArr) };
                                      saveSavedMockups(next);
                                      return next;
                                    });
                                  }}
                                  title="Delete current"
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        )}
                      </Dialog>
                    </>
                  ) : (
                    <button
                      className="w-24 h-24 border rounded flex flex-col items-center justify-center text-xs text-gray-600 hover:bg-gray-50"
                      onClick={() => generateMockup(r.id, 1)}
                      disabled={!!mockupLoading[r.id]}
                      title="Generate mockup"
                    >
                      {mockupLoading[r.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin mb-1" />
                      ) : (
                        <ImageIcon className="h-4 w-4 mb-1" />
                      )}
                      {mockupLoading[r.id] ? 'Generating…' : 'Generate'}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                <div className="flex items-center gap-2 mr-2">
                  <span className="text-xs text-gray-600">More</span>
                  <Input
                    type="number"
                    min={1}
                    max={8}
                    className="w-16 h-8 text-sm"
                    value={mockupGenerateCounts[r.id] ?? 1}
                    onChange={(e) => {
                      const v = parseInt(e.target.value || '1', 10);
                      setMockupGenerateCounts(prev => ({ ...prev, [r.id]: Math.max(1, Math.min(8, isNaN(v) ? 1 : v)) }));
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateMockup(r.id, mockupGenerateCounts[r.id] ?? 1)}
                    disabled={!!mockupLoading[r.id]}
                    title="Generate more previews"
                  >
                    {mockupLoading[r.id] ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ImageIcon className="h-4 w-4 mr-2" />}
                    Generate More
                  </Button>
                </div>
                {Array.isArray(selectedMockups[r.id]) && selectedMockups[r.id].length > 0 && (
                  <div className="flex items-center gap-2 mr-2">
                    <span className="text-xs text-green-700 bg-green-50 border border-green-100 px-1.5 py-0.5 rounded self-center">
                      Saved previews: {selectedMockups[r.id].length}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sendSelectedToWorkflow(r)}
                      disabled={!!sendingToWorkflow[r.id]}
                      title="Send saved previews to Workflow"
                    >
                      {sendingToWorkflow[r.id] ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <UploadIcon className="h-4 w-4 mr-2"/>}
                      Send Saved to Workflow
                    </Button>
                  </div>
                )}
                {sendSuccessCount[r.id] ? (
                  <span className="text-xs text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded self-center mr-2">
                    Sent {sendSuccessCount[r.id]} to Workflow
                  </span>
                ) : null}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => regenerateDescription(r)}
                  disabled={!!descLoading[r.id]}
                  title="Regenerate only the description sentence"
                >
                  {descLoading[r.id] ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshIcon className="h-4 w-4"/>}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => completeAndMoveToWF(r)}
                  title="Move to Workflow"
                >
                  <UploadIcon className="h-4 w-4 mr-1" /> Move to WF
                </Button>
                <Button variant={copied[r.id] ? 'default' : 'outline'} size="icon" onClick={() => copyRow(r.description, r.id)} title={copied[r.id] ? 'Copied!' : 'Copy'}>
                  {copied[r.id] ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button variant={r.saved ? 'default' : 'outline'} size="icon" onClick={() => toggleSave(r.id)} title={r.saved ? 'Saved' : 'Save'}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="destructive" size="icon" onClick={() => deleteRow(r.id)} title="Delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
                </div>
              </div>
            </div>
          ))}

          {filteredSortedRows.length === 0 && (
            <div className="py-8 text-center text-gray-500">No ideas yet. Generate some using the form above.</div>
          )}
        </CardContent>
      </Card>

      {/* My Styles Manager Dialog */}
      <Dialog open={showStylesManager} onOpenChange={setShowStylesManager}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage My Styles</DialogTitle>
          </DialogHeader>
          <MyStylesManager styles={userStyles} onChange={(next) => { setUserStyles(next); saveUserStyles(next); }} />
        </DialogContent>
      </Dialog>
      
    </main>
  );
}
