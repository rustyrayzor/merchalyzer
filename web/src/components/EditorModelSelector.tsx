"use client";

import { useEffect, useMemo, useState } from "react";
import { loadEditModelPresets, saveEditModelPreset, deleteEditModelPreset, loadDefaultEditModel, saveDefaultEditModel, clearDefaultEditModel } from "@/lib/storage";
import type { ModelPreset } from "@/lib/types";

interface EditorModelSelectorProps {
  model: string;
  onModelChange: (model: string) => void;
}

const DEFAULT_EDIT_MODELS: Array<{ value: string; label: string; vision?: boolean }> = [
  { value: "google/gemini-2.5-flash-image-preview:free", label: "Gemini 2.5 Flash Image Preview (free)", vision: true },
];

export default function EditorModelSelector({ model, onModelChange }: EditorModelSelectorProps) {
  const [presets, setPresets] = useState<ModelPreset[]>([]);
  const [newPresetLabel, setNewPresetLabel] = useState("");
  const [newPresetModel, setNewPresetModel] = useState("");
  const [flash, setFlash] = useState<string>("");
  const [showPresets, setShowPresets] = useState(true);

  useEffect(() => {
    setPresets(loadEditModelPresets());
    const def = loadDefaultEditModel();
    if (def && model !== def) {
      onModelChange(def);
    }
  }, [model, onModelChange]);

  function showFlash(message: string) {
    setFlash(message);
    window.setTimeout(() => setFlash(""), 1800);
  }

  const allOptions = useMemo(() => {
    const byValue = new Map<string, { value: string; label: string; vision?: boolean }>();
    for (const m of DEFAULT_EDIT_MODELS) byValue.set(m.value, m);
    for (const p of presets) byValue.set(p.model, { value: p.model, label: p.label, vision: p.vision });
    return Array.from(byValue.values());
  }, [presets]);

  return (
    <div className="flex flex-col gap-2">
      {flash && (
        <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded border border-green-200 shadow-sm self-end">
          {flash}
        </div>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-600">Edit Model</span>
        <div className="flex items-center gap-2">
          <select
            className="border rounded p-2 flex-1"
            value={model}
            onChange={(e) => {
              onModelChange(e.target.value);
              showFlash("Model selected");
            }}
          >
            {allOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}{o.vision ? " (👁️ Vision)" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label="Edit model presets"
            title="Edit model presets"
            className="p-2 rounded border bg-white hover:bg-gray-50 hover:ring-2 hover:ring-blue-300 transition"
            onClick={() => setShowPresets((v) => !v)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-700">
              <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-10.03 10.03a4.125 4.125 0 0 0-1.098 1.837l-.8 2.803a.75.75 0 0 0 .928.928l2.803-.8a4.125 4.125 0 0 0 1.837-1.098l10.03-10.03Z"/>
            </svg>
          </button>
        </div>
        <div className="flex gap-2 mt-2">
          <button
            className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 hover:ring-2 hover:ring-gray-300 transition"
            onClick={() => {
              saveDefaultEditModel(model);
              showFlash('Default edit model saved');
            }}
          >
            Save default edit model
          </button>
          <button
            className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 hover:ring-2 hover:ring-gray-300 transition"
            onClick={() => {
              const def = loadDefaultEditModel();
              if (def) {
                onModelChange(def);
                showFlash('Default edit model loaded');
              }
            }}
          >
            Load default edit model
          </button>
          <button
            className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 hover:ring-2 hover:ring-gray-300 transition"
            onClick={() => {
              clearDefaultEditModel();
              showFlash('Default edit model cleared');
            }}
          >
            Clear default
          </button>
        </div>

        <div className={`mt-3 transition-all duration-300 overflow-hidden ${showPresets ? 'opacity-100 max-h-[560px]' : 'opacity-0 max-h-0'}`}>
          <div className="flex flex-col gap-2 border rounded p-3 bg-white">
            <span className="text-sm text-gray-600">Edit model presets</span>
            <div className="grid sm:grid-cols-3 gap-2">
              <input
                className="border rounded p-2"
                placeholder="Preset label (e.g. Gemini Edit)"
                value={newPresetLabel}
                onChange={(e) => setNewPresetLabel(e.target.value)}
              />
              <input
                className="border rounded p-2 sm:col-span-2"
                placeholder="OpenRouter model id (e.g. google/gemini-2.5-flash-image-preview:free)"
                value={newPresetModel}
                onChange={(e) => setNewPresetModel(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 hover:ring-2 hover:ring-gray-300 transition"
                onClick={() => {
                  if (!newPresetLabel.trim() || !newPresetModel.trim()) return;
                  const preset: ModelPreset = {
                    id: `${Date.now()}`,
                    label: newPresetLabel.trim(),
                    model: newPresetModel.trim(),
                    vision: /vision|image|gemini|gpt-5|gpt-4o|llama-4|maverick/i.test(newPresetModel.trim()),
                  };
                  const updated = saveEditModelPreset(preset);
                  setPresets(updated);
                  setNewPresetLabel("");
                  setNewPresetModel("");
                  showFlash('Model preset saved');
                }}
              >
                Save preset
              </button>
            </div>
            {presets.length > 0 && (
              <ul className="divide-y text-sm">
                {presets.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <button
                        className="text-blue-700 underline"
                        onClick={() => onModelChange(p.model)}
                        title={p.model}
                      >
                        {p.label} {p.vision ? '👁️' : ''}
                      </button>
                      <span className="text-gray-500">({p.model})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => setPresets(deleteEditModelPreset(p.id))}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </label>
    </div>
  );
}


