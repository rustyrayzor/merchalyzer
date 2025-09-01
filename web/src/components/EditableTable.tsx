"use client";

import { useState } from "react";
import { FieldName, RowData } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
// import { Input } from "@/components/ui/input"; // Not currently used
import { Loader2, RotateCcw } from "lucide-react";

interface EditableTableProps {
  rows: RowData[];
  setRows: (rows: RowData[]) => void;
  imageUrls?: Record<string, string>;
  // Map of imageName -> data URL for vision models
  imageBase64Map?: Record<string, string>;
  model: string;
  instructions: string;
  defaultBrand: string;
  defaultKeywords: string;
}

async function regenerateField(
  payload: {
    imageName: string;
    instructions: string;
    brand?: string;
    keywords?: string;
    model: string;
    field: FieldName;
    imageBase64?: string;
  }
) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, mode: "field" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }
  const modelUsed = res.headers.get('X-Model-Used') || '';
  const promptPreview = res.headers.get('X-User-Prompt-Preview') || '';
  if (modelUsed) console.log('Regen field model used:', modelUsed);
  if (promptPreview) console.log('Regen field prompt preview:', promptPreview);
  const systemPreview = res.headers.get('X-System-Prompt-Preview') || '';
  if (systemPreview) console.log('System prompt preview:', systemPreview);
  const data = (await res.json()) as { field: FieldName; value: string };
  return { ...data, modelUsed } as { field: FieldName; value: string; modelUsed: string };
}

async function regenerateRow(
  payload: {
    imageName: string;
    instructions: string;
    brand?: string;
    keywords?: string;
    model: string;
    imageBase64?: string;
  }
) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, mode: "row" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }
  const modelUsed = res.headers.get('X-Model-Used') || '';
  const promptPreview = res.headers.get('X-User-Prompt-Preview') || '';
  if (modelUsed) console.log('Regen row model used:', modelUsed);
  if (promptPreview) console.log('Regen row prompt preview:', promptPreview);
  const systemPreview = res.headers.get('X-System-Prompt-Preview') || '';
  if (systemPreview) console.log('System prompt preview:', systemPreview);
  const data = (await res.json()) as { fields: Omit<RowData, "imageName"> };
  return { ...data, modelUsed } as { fields: Omit<RowData, "imageName">; modelUsed: string };
}

export default function EditableTable({
  rows,
  setRows,
  imageUrls,
  imageBase64Map,
  model,
  instructions,
  defaultBrand,
  defaultKeywords,
}: EditableTableProps) {
  const [loading, setLoading] = useState<{ key: string | null }>({ key: null });

  const updateCell = (idx: number, field: FieldName, value: string) => {
    const next = [...rows];
    next[idx] = { ...next[idx], [field]: value };
    setRows(next);
  };

  const onRegenerateField = async (idx: number, field: FieldName) => {
    const row = rows[idx];
    setLoading({ key: `${idx}:${field}` });
    try {
      const { value, modelUsed } = await regenerateField({
        imageName: row.imageName,
        instructions,
        brand: row.brand || defaultBrand || undefined,
        keywords: defaultKeywords || undefined,
        model,
        field,
        imageBase64: imageBase64Map?.[row.imageName],
      });
      if (modelUsed) {
        console.log('Regen field model used:', modelUsed);
      }
      updateCell(idx, field, value);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Regenerate ${field} failed for ${row.imageName}: ${msg}`);
    } finally {
      setLoading({ key: null });
    }
  };

  const onRegenerateRow = async (idx: number) => {
    const row = rows[idx];
    setLoading({ key: `${idx}:row` });
    try {
      const { fields, modelUsed } = await regenerateRow({
        imageName: row.imageName,
        instructions,
        brand: row.brand || defaultBrand || undefined,
        keywords: defaultKeywords || undefined,
        model,
        imageBase64: imageBase64Map?.[row.imageName],
      });
      if (modelUsed) {
        console.log('Regen row model used:', modelUsed);
      }
      const next = [...rows];
      next[idx] = { ...row, ...fields };
      setRows(next);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Regenerate row failed for ${row.imageName}: ${msg}`);
    } finally {
      setLoading({ key: null });
    }
  };



  return (
    <div className="overflow-x-auto w-full">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-2">Image</th>
            <th className="text-left p-2">Image Name</th>
            <th className="text-left p-2">Brand</th>
            <th className="text-left p-2">Title</th>
            <th className="text-left p-2">Bullet 1</th>
            <th className="text-left p-2">Bullet 2</th>
            <th className="text-left p-2">Description</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.imageName} className="border-b hover:bg-gray-50 transition-colors">
              <td className="p-2 align-top">
                {imageUrls?.[row.imageName] ? (
                  <img // eslint-disable-line @next/next/no-img-element
                    src={imageUrls[row.imageName]}
                    alt={row.imageName}
                    className="w-16 h-16 object-contain border rounded bg-white"
                  />
                ) : (
                  <div className="w-16 h-16 border rounded bg-gray-100" />
                )}
              </td>
              <td className="p-2 align-top text-xs sm:text-sm whitespace-nowrap">
                {row.imageName}
              </td>
              <td className="p-2 align-top">
                <Textarea
                  className="w-48 min-h-[60px] resize-none"
                  value={row.brand}
                  onChange={(e) => updateCell(idx, "brand", e.target.value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1 h-6 px-2 text-xs"
                  disabled={loading.key === `${idx}:brand`}
                  onClick={() => onRegenerateField(idx, "brand")}
                >
                  {loading.key === `${idx}:brand` && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  <RotateCcw className="h-3 w-3 mr-1" />
                  {loading.key === `${idx}:brand` ? "Generating..." : "Regen"}
                </Button>
              </td>
              <td className="p-2 align-top">
                <Textarea
                  className="w-64 min-h-[60px] resize-none"
                  value={row.title}
                  onChange={(e) => updateCell(idx, "title", e.target.value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1 h-6 px-2 text-xs"
                  disabled={loading.key === `${idx}:title`}
                  onClick={() => onRegenerateField(idx, "title")}
                >
                  {loading.key === `${idx}:title` && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  <RotateCcw className="h-3 w-3 mr-1" />
                  {loading.key === `${idx}:title` ? "Generating..." : "Regen"}
                </Button>
              </td>
              <td className="p-2 align-top">
                <Textarea
                  className="w-64 min-h-[60px] resize-none"
                  value={row.bullet1}
                  onChange={(e) => updateCell(idx, "bullet1", e.target.value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1 h-6 px-2 text-xs"
                  disabled={loading.key === `${idx}:bullet1`}
                  onClick={() => onRegenerateField(idx, "bullet1")}
                >
                  {loading.key === `${idx}:bullet1` && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  <RotateCcw className="h-3 w-3 mr-1" />
                  {loading.key === `${idx}:bullet1` ? "Generating..." : "Regen"}
                </Button>
              </td>
              <td className="p-2 align-top">
                <Textarea
                  className="w-64 min-h-[60px] resize-none"
                  value={row.bullet2}
                  onChange={(e) => updateCell(idx, "bullet2", e.target.value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1 h-6 px-2 text-xs"
                  disabled={loading.key === `${idx}:bullet2`}
                  onClick={() => onRegenerateField(idx, "bullet2")}
                >
                  {loading.key === `${idx}:bullet2` && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  <RotateCcw className="h-3 w-3 mr-1" />
                  {loading.key === `${idx}:bullet2` ? "Generating..." : "Regen"}
                </Button>
              </td>
              <td className="p-2 align-top">
                <Textarea
                  className="w-80 min-h-[80px] resize-none"
                  value={row.description}
                  onChange={(e) => updateCell(idx, "description", e.target.value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1 h-6 px-2 text-xs"
                  disabled={loading.key === `${idx}:description`}
                  onClick={() => onRegenerateField(idx, "description")}
                >
                  {loading.key === `${idx}:description` && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  <RotateCcw className="h-3 w-3 mr-1" />
                  {loading.key === `${idx}:description` ? "Generating..." : "Regen"}
                </Button>
              </td>
              <td className="p-2 align-top whitespace-nowrap">
                <Button
                  variant="default"
                  size="sm"
                  disabled={loading.key === `${idx}:row`}
                  onClick={() => onRegenerateRow(idx)}
                >
                  {loading.key === `${idx}:row` && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {loading.key === `${idx}:row` ? "Generating..." : "Regen row"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


