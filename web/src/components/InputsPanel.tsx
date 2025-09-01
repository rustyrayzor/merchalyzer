"use client";

import { useEffect, useMemo, useState } from "react";
import { loadModelPresets, saveModelPreset, deleteModelPreset, loadTemplates, saveTemplate, deleteTemplate, loadDefaultInstructions, saveDefaultInstructions, clearDefaultInstructions, loadDefaultModel, saveDefaultModel, clearDefaultModel, loadDefaultBrand, saveDefaultBrand, clearDefaultBrand, loadDefaultKeywords, saveDefaultKeywords, clearDefaultKeywords } from "@/lib/storage";
import type { ModelPreset, TemplateItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, Save, RotateCcw, Trash2, Plus, Settings as SettingsIcon } from "lucide-react";

interface InputsPanelProps {
  model: string;
  instructions: string;
  brand: string;
  keywords: string;
  onChange: (next: {
    model?: string;
    instructions?: string;
    brand?: string;
    keywords?: string;
  }) => void;
  showModelSection?: boolean;
  showInstructionsSection?: boolean;
  showBrandKeywords?: boolean;
  showInstructionTemplates?: boolean;
}

const DEFAULT_MODELS: Array<{ value: string; label: string; vision?: boolean }> = [
  { value: "openrouter/auto", label: "OpenRouter Auto" },
  { value: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B" },
  { value: "openai/gpt-4o-mini-2024-07-18", label: "GPT-4o mini", vision: true },
  { value: "meta-llama/llama-4-maverick:free", label: "Llama 4 Maverick (Vision, free)", vision: true },
  { value: "google/gemini-2.5-flash-image-preview", label: "Gemini 2.5 Flash (Vision)", vision: true },
];

export default function InputsPanel({
  model,
  instructions,
  brand,
  keywords,
  onChange,
  showModelSection = true,
  showInstructionsSection = true,
  showBrandKeywords = true,
  showInstructionTemplates = true,
}: InputsPanelProps & { showModelSection?: boolean; showInstructionsSection?: boolean; showBrandKeywords?: boolean; showInstructionTemplates?: boolean; }) {

  // const idPrefix = useId(); // Not currently used
  const [presets, setPresets] = useState<ModelPreset[]>([]);
  const [newPresetLabel, setNewPresetLabel] = useState("");
  const [newPresetModel, setNewPresetModel] = useState("");
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [showModelPresets, setShowModelPresets] = useState(true);
  const [showInstructions, setShowInstructions] = useState(true);
  // const SEED_DEFAULT_INSTRUCTIONS = `Design Title: No more than 60 characters, always try include relevant keywords in the title. Do NOT include "T-Shirt", gift, shirt, tees, tshirt, t-shirt, art in the title.
  //
  // Brand: No more than 50 characters, include relevant and keyword-rich. Do NOT include "T-Shirt", gift, shirt, tees, tshirt, t-shirt.
  //
  // Feature Bullet 1: Max 250 characters. Focus on the humor, theme, who it's for, or lifestyle. Do NOT include "T-Shirt", gift, shirt, tees, tshirt, t-shirt.
  //
  // Feature Bullet 2: Max 250 characters. Mention gifting occasions, holidays, or usage. Do NOT include "T-Shirt", gift, shirt, tees, tshirt, t-shirt.
  //
  // Product Description: Max 512 characters. Brief and engaging summary of what the design is, who it's for, and why it's great including keywords and seo optimized. Use a friendly tone with light marketing flair. Do NOT include "T-Shirt", gift, shirt, tees, tshirt, t-shirt.`;

  useEffect(() => {
    setPresets(loadModelPresets());
    setTemplates(loadTemplates());
    if (showInstructionsSection) {
      const def = loadDefaultInstructions();
      if (def !== null && !instructions) {
        onChange({ instructions: def });
      }
    }
    const defModel = loadDefaultModel();
    // Only load default model if no model is currently set (initial load)
    if (defModel && !model) {
      onChange({ model: defModel });
    }
    const defBrand = loadDefaultBrand();
    // Only load default brand if no brand is currently set (initial load)
    if (defBrand && !brand) {
      onChange({ brand: defBrand });
    }
    const defKeywords = loadDefaultKeywords();
    // Only load default keywords if no keywords are currently set (initial load)
    if (defKeywords && !keywords) {
      onChange({ keywords: defKeywords });
    }
  }, [showInstructionsSection, instructions, onChange, model, brand, keywords]);

  const [flash, setFlash] = useState<string>("");
  function showFlash(message: string) {
    setFlash(message);
    window.setTimeout(() => setFlash(""), 1800);
  }

  const allModelOptions = useMemo(() => {
    const byValue = new Map<string, { label: string; value: string; vision?: boolean }>();
    // Seed with defaults
    for (const m of DEFAULT_MODELS) {
      byValue.set(m.value, { label: m.label, value: m.value, vision: m.vision });
    }
    // Overlay presets (override defaults when same value)
    for (const p of presets) {
      byValue.set(p.model, { label: p.label, value: p.model, vision: p.vision });
    }
    return Array.from(byValue.values());
  }, [presets]);

  // Ensure the current model value exists in options, fallback to first option if not
  const validModelValue = useMemo(() => {
    const found = allModelOptions.find(opt => opt.value === model);
    return found?.value || allModelOptions[0]?.value || model;
  }, [model, allModelOptions]);
  return (
    <div className="w-full grid gap-3 sm:grid-cols-2">
      {showModelSection && (
      <div className="flex flex-col gap-1 relative">
        {flash && (
          <div className="absolute -top-6 right-0 text-xs bg-green-100 text-green-800 px-2 py-1 rounded border border-green-200 shadow-sm">
            {flash}
          </div>
        )}
        <span className="text-sm text-gray-600">Model</span>
        <div className="flex items-center gap-2">
          <Select
            value={validModelValue}
            onValueChange={(selectedModel) => {
              onChange({ model: selectedModel });
              const selectedOption = allModelOptions.find(m => m.value === selectedModel);
              showFlash(`Model selected: ${selectedOption?.label || selectedModel}`);
            }}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {allModelOptions.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}{m.vision ? " (👁️ Vision)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Edit model presets"
            title="Edit model presets"
            onClick={() => setShowModelPresets((v) => !v)}
          >
            <SettingsIcon className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              saveDefaultModel(model);
              showFlash('Default model saved');
            }}
          >
            <Save className="h-4 w-4 mr-2" />
            Save default
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const def = loadDefaultModel();
              if (def) {
                onChange({ model: def });
                showFlash('Default model loaded');
              }
            }}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Load default
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              clearDefaultModel();
              showFlash('Default model cleared');
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear default
          </Button>
        </div>

        <Card className={`mt-3 transition-all duration-300 overflow-hidden ${showModelPresets ? 'opacity-100 max-h-[560px]' : 'opacity-0 max-h-0'}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Model presets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-2">
              <Input
                placeholder="Preset label (e.g. My GPT-4o)"
                value={newPresetLabel}
                onChange={(e) => setNewPresetLabel(e.target.value)}
              />
              <Input
                className="sm:col-span-2"
                placeholder="Paste OpenRouter model id (e.g. openrouter/auto)"
                value={newPresetModel}
                onChange={(e) => setNewPresetModel(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!newPresetLabel.trim() || !newPresetModel.trim()) return;
                const preset: ModelPreset = {
                  id: `${Date.now()}`,
                  label: newPresetLabel.trim(),
                  model: newPresetModel.trim(),
                  vision: /vision|gpt-4o|image|multimodal|llava|gemini|claude-3|gpt-4v|llama-4|maverick/i.test(newPresetModel.trim()),
                };
                const updated = saveModelPreset(preset);
                setPresets(updated);
                setNewPresetLabel("");
                setNewPresetModel("");
                showFlash('Model preset saved');
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Save preset
            </Button>
            {presets.length > 0 && (
              <ul className="divide-y text-sm">
                {presets.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <button
                        className="text-blue-700 underline"
                        onClick={() => onChange({ model: p.model })}
                        title={p.model}
                      >
                        {p.label} {p.vision ? '👁️' : ''}
                      </button>
                      <span className="text-gray-500">({p.model})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          setPresets(deleteModelPreset(p.id));
                          showFlash('Preset deleted');
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {showInstructionsSection && (
      <label className="flex flex-col gap-1 sm:col-span-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Global Instructions</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Edit instructions"
            title="Edit instructions"
            onClick={() => setShowInstructions((v) => !v)}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
        <div className={`transition-all duration-300 overflow-hidden ${showInstructions ? 'opacity-100 max-h-[800px] mt-2' : 'opacity-0 max-h-0'}`}>
          <Textarea
            className="min-h-24"
            value={instructions}
            onChange={(e) => onChange({ instructions: e.target.value })}
            onBlur={() => showFlash('Instructions updated')}
            placeholder="Describe tone, style, constraints..."
          />
          <div className="flex gap-2 mt-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                saveDefaultInstructions(instructions);
                showFlash('Default instructions saved');
              }}
            >
              <Save className="h-4 w-4 mr-2" />
              Save as default
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const def = loadDefaultInstructions();
                if (def !== null) {
                  onChange({ instructions: def });
                  showFlash('Default instructions loaded');
                }
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Load default
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearDefaultInstructions();
                showFlash('Default instructions cleared');
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear default
            </Button>
          </div>
        </div>
      </label>
      )}



      {showBrandKeywords && (
      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-600">Brand (optional)</span>
        <Input
          value={brand}
          onChange={(e) => onChange({ brand: e.target.value })}
          placeholder="Your brand name"
        />
        <div className="flex gap-2 mt-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              saveDefaultBrand(brand);
              showFlash('Default brand saved');
            }}
          >
            <Save className="h-4 w-4 mr-2" />
            Save default
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const def = loadDefaultBrand();
              if (def) {
                onChange({ brand: def });
                showFlash('Default brand loaded');
              }
            }}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Load default
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              clearDefaultBrand();
              showFlash('Default brand cleared');
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear default
          </Button>
        </div>
      </label>
      )}

      {showBrandKeywords && (
      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-600">Keywords (optional)</span>
        <Input
          value={keywords}
          onChange={(e) => onChange({ keywords: e.target.value })}
          placeholder="comma,separated,keywords"
        />
        <div className="flex gap-2 mt-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              saveDefaultKeywords(keywords);
              showFlash('Default keywords saved');
            }}
          >
            <Save className="h-4 w-4 mr-2" />
            Save default
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const def = loadDefaultKeywords();
              if (def) {
                onChange({ keywords: def });
                showFlash('Default keywords loaded');
              }
            }}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Load default
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              clearDefaultKeywords();
              showFlash('Default keywords cleared');
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear default
          </Button>
        </div>
      </label>
      )}

      {showInstructionTemplates && (
      <Card className="sm:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Instruction templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-2">
            <Input
              placeholder="Template name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!templateName.trim() || !instructions.trim()) return;
                const item: TemplateItem = {
                  id: `${Date.now()}`,
                  name: templateName.trim(),
                  value: instructions,
                };
                const updated = saveTemplate(item);
                setTemplates(updated);
                setTemplateName("");
                showFlash('Template saved');
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Save template
            </Button>
          </div>
          {templates.length > 0 && (
            <div className="space-y-2">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <Button
                    variant="ghost"
                    className="justify-start h-auto p-0 text-primary hover:text-primary/80"
                    onClick={() => {
                      onChange({ instructions: t.value });
                      showFlash('Template loaded');
                    }}
                  >
                    {t.name}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setTemplates(deleteTemplate(t.id));
                      showFlash('Template deleted');
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}


