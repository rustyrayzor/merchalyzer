"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TagInput from "@/components/ui/tag-input";
import { loadDefaultModel, saveDefaultModel } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Copy, Download, Loader2, Save, Trash2, Image as ImageIcon, Maximize2, Settings, GitMerge, X, Shuffle, Dice5 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";

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
}

const STORAGE_KEY = "merchalyzer.designIdeas.v1";

const DEFAULT_MODELS: Array<{ value: string; label: string }> = [
  { value: "openrouter/auto", label: "OpenRouter Auto" },
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
  'Christian': ['Youth Ministry', 'Worship & Music Ministry', 'Bible Study', 'Fellowship', 'Small Groups', 'Church Camp', 'Prayer & Faith', 'Scripture Art'],
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
  const [mockups, setMockups] = useState<Record<string, string>>({});
  const [mockupLoading, setMockupLoading] = useState<Record<string, boolean>>({});
  const [previewOpenId, setPreviewOpenId] = useState<string | null>(null);
  const [showSecondary, setShowSecondary] = useState(false);
  const [secondaryNiche, setSecondaryNiche] = useState<string>("");
  const [selectedSecondarySubs, setSelectedSecondarySubs] = useState<string[]>([]);
  const secondarySubs = useMemo(() => subNichesByPrimary[secondaryNiche] || [], [secondaryNiche, subNichesByPrimary]);


  // Load default model, niches, sub-niches, and persisted rows
  useEffect(() => {
    const def = loadDefaultModel();
    if (def) setModel(def);
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
    if (sub) appendToPrompt(sub);
    else appendToPrompt(sec);
  }

  function superRandomize() {
    if (!Array.isArray(primaryNiches) || primaryNiches.length === 0) return;
    const prim = pickRandom(primaryNiches);
    if (!prim) return;
    // Change primary niche
    setNiche(prim);
    const primSubs = subNichesByPrimary[prim] || [];
    const psub = pickRandom(primSubs);
    // Wait a microtask so the effect that clears selectedPrimarySubs runs first
    setTimeout(() => {
      setSelectedPrimarySubs(psub ? [psub] : []);
    }, 0);
    // Populate prompt with chosen primary/sub so Generate is enabled
    appendToPrompt(psub || prim);

    // Secondary
    setShowSecondary(true);
    const secCandidates = primaryNiches.filter((n) => n !== prim);
    const sec = pickRandom(secCandidates.length > 0 ? secCandidates : primaryNiches);
    if (sec) {
      setSecondaryNiche(sec);
      const ssubs = subNichesByPrimary[sec] || [];
      const ssub = pickRandom(ssubs);
      setSelectedSecondarySubs(ssub ? [ssub] : []);
      appendToPrompt(ssub || sec);
    } else {
      setSecondaryNiche('');
      setSelectedSecondarySubs([]);
    }
  }

  async function generateIdeas() {
    const p = effectivePrompt;
    if (!p) return;
    setIsLoading(true);
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

      const res = await fetch('/api/design-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: pWithMeta, count: count || 1, model, tone: chosenTone, tshirtStyle: chosenStyle }),
      });
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

  async function generateMockup(id: string, idea: string) {
    setMockupLoading(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch('/api/design-mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, model: mockupModel }),
      });
      if (!res.ok) {
        const text = await res.text();
        try { const err = JSON.parse(text) as { error?: string }; alert(err.error || text); }
        catch { alert(text); }
        return;
      }
      const data = await res.json() as { base64DataUrl: string };
      setMockups(prev => ({ ...prev, [id]: data.base64DataUrl }));
    } finally {
      setMockupLoading(prev => ({ ...prev, [id]: false }));
    }
  }

  function toggleComplete(id: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: r.status === 'completed' ? 'pending' : 'completed' } : r));
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
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { saveDefaultModel(model); }} title="Save as default model">
                      <Save className="h-4 w-4 mr-2"/>Save default
                    </Button>
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-gray-600">Mockup model</span>
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
                  </label>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 sm:col-span-3">
              <span className="text-sm text-gray-600">Prompt</span>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Christian women’s tees with floral themes"
                className="min-h-24"
              />
            </label>
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
              <div className="mt-2 flex gap-2">
                <Input
                  value={newPrimary}
                  onChange={(e) => setNewPrimary(e.target.value)}
                  placeholder="Add new primary niche (e.g., Christian, Electrician)"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    const v = (newPrimary || '').trim();
                    if (!v) return;
                    if (!primaryNiches.includes(v)) {
                      const next = [v, ...primaryNiches];
                      setPrimaryNiches(next);
                      setNiche(v);
                    } else {
                      setNiche(v);
                    }
                    setNewPrimary('');
                  }}
                >
                  Add
                </Button>
              </div>
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Sub-niches for {niche || '—'}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  title="Add secondary niche"
                  aria-label="Add secondary niche"
                  onClick={() => setShowSecondary((v) => !v)}
                >
                  {showSecondary ? <X className="h-4 w-4" /> : <GitMerge className="h-4 w-4" />}
                </Button>
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
                      if (willAdd) appendToPrompt(t); else removeFromPrompt(t);
                    }}
                    title={`Toggle ${t}`}
                  >
                    {t}
                  </Button>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Selected primary sub‑niches will be combined with the prompt on generate.</span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPrimarySubs([])} disabled={selectedPrimarySubs.length === 0}>Clear</Button>
              </div>
            </label>

            {/* Secondary (cross‑niche) inline controls */}
            {showSecondary && (
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Secondary primary niche</span>
              <Select value={secondaryNiche} onValueChange={(v) => { setSecondaryNiche(v); setSelectedSecondarySubs([]); }}>
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
            )}
            {showSecondary && (
            <label className="flex flex-col gap-1 sm:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Sub‑niches for {secondaryNiche || '—'} (secondary)</span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedSecondarySubs([])} disabled={!secondaryNiche || selectedSecondarySubs.length === 0}>Clear</Button>
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
                      if (willAdd) appendToPrompt(t); else removeFromPrompt(t);
                    }}
                    title={`Toggle ${t}`}
                  >
                    {t}
                  </Button>
                ))}
              </div>
              <span className="text-xs text-gray-500">Selected secondary sub‑niches will be combined with the prompt on generate.</span>
            </label>
            )}
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
                  {[
                    // Keep Auto first
                    'Auto',
                    // Popularity‑oriented ordering
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
                  ].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={generateIdeas} disabled={isLoading || !effectivePrompt.trim()}>
              {isLoading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Generating…</>) : 'Generate'}
            </Button>
            <Button type="button" variant="outline" onClick={randomizeSecondary} title="Pick a random secondary niche + sub‑niche">
              <Shuffle className="h-4 w-4 mr-2"/> Randomizer
            </Button>
            <Button type="button" variant="outline" onClick={superRandomize} title="Pick random primary + sub‑niche and secondary + sub‑niche">
              <Dice5 className="h-4 w-4 mr-2"/> Super Randomizer
            </Button>
          </div>
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
            <div className="flex gap-2 mt-3">
              {!anySelected ? (
                <>
                  <Button variant="outline" onClick={selectAllVisible}>Select all</Button>
                  <Button variant="outline" onClick={clearSelection}>Clear selection</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={bulkComplete}><CheckCircle2 className="h-4 w-4 mr-2"/>Mark completed</Button>
                  <Button variant="destructive" onClick={bulkDelete}><Trash2 className="h-4 w-4 mr-2"/>Delete selected</Button>
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
                <div className="text-[11px] text-gray-400 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</div>
              </div>

              <div className="mt-2 text-sm whitespace-pre-wrap leading-snug">
                {r.description}
              </div>

              <div className="mt-2 text-xs text-gray-600">
                <span className="font-medium">Prompt:</span>{' '}
                <span title={r.prompt} className="align-middle">{r.prompt.length > 160 ? r.prompt.slice(0, 160) + '…' : r.prompt}</span>
              </div>

              <div className="mt-3">
                <TagInput value={r.tags} onChange={(tags) => updateTags(r.id, tags)} placeholder="add,tag" />
              </div>

              <div className="mt-3 flex flex-wrap gap-2 justify-between items-center">
                <div className="flex items-center gap-3">
                  {mockups[r.id] ? (
                    <Dialog open={previewOpenId === r.id} onOpenChange={(open) => setPreviewOpenId(open ? r.id : null)}>
                      <DialogTrigger asChild>
                        <button className="group relative w-24 h-24 border rounded overflow-hidden bg-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={mockups[r.id]} alt="Mockup" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <Maximize2 className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-3xl">
                        <DialogHeader>
                          <DialogTitle>Mockup Preview</DialogTitle>
                        </DialogHeader>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={mockups[r.id]} alt="Mockup large" className="w-full h-auto rounded" />
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <button
                      className="w-24 h-24 border rounded flex flex-col items-center justify-center text-xs text-gray-600 hover:bg-gray-50"
                      onClick={() => generateMockup(r.id, r.description)}
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
                <Button variant={copied[r.id] ? 'default' : 'outline'} size="sm" onClick={() => copyRow(r.description, r.id)} title={copied[r.id] ? 'Copied!' : 'Copy to clipboard'}>
                  {copied[r.id] ? (<><CheckCircle2 className="h-4 w-4 mr-1" /> Copied</>) : (<><Copy className="h-4 w-4 mr-1" /> Copy</>)}
                </Button>
                <Button variant={r.saved ? 'default' : 'outline'} size="sm" onClick={() => toggleSave(r.id)} title="Save for later">
                  <Download className="h-4 w-4 mr-1" /> {r.saved ? 'Saved' : 'Save'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggleComplete(r.id)} title="Mark complete">
                  <CheckCircle2 className="h-4 w-4 mr-1" /> {r.status === 'completed' ? 'Mark pending' : 'Mark complete'}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => deleteRow(r.id)} title="Delete">
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
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
    </main>
  );
}
