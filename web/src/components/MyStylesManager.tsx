"use client";

import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { generateUUID } from '@/lib/utils';
import type { UserStyle } from '@/lib/storage';

interface Props {
  styles: UserStyle[];
  onChange: (styles: UserStyle[]) => void;
}

export default function MyStylesManager({ styles, onChange }: Props) {
  const [local, setLocal] = useState<UserStyle[]>(styles);
  const [editing, setEditing] = useState<UserStyle | null>(null);

  useEffect(() => setLocal(styles), [styles]);

  function startAdd() {
    setEditing({ id: generateUUID(), name: '', label: '', details: '', tags: [] });
  }

  function saveEdit() {
    if (!editing) return;
    const trimmedName = (editing.name || '').trim();
    if (!trimmedName) return;
    const next = [...local.filter((s) => s.id !== editing.id), { ...editing, name: trimmedName }];
    setLocal(next);
    onChange(next);
    setEditing(null);
  }

  function remove(id: string) {
    const next = local.filter((s) => s.id !== id);
    setLocal(next);
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">My Styles</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {local.length === 0 && <div className="text-sm text-gray-500">No styles yet.</div>}
          {local.map((s) => (
            <div key={s.id} className="border rounded p-3 space-y-1">
              <div className="flex items-center justify-between">
                <div className="font-medium">{s.name}</div>
                <div className="space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(s)}>Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => remove(s.id)}>Delete</Button>
                </div>
              </div>
              {s.label && <div className="text-xs text-gray-600">Label: {s.label}</div>}
              {s.details && <div className="text-xs text-gray-600">{s.details}</div>}
              {s.tags && s.tags.length > 0 && (
                <div className="text-[11px] text-gray-500">Tags: {s.tags.join(', ')}</div>
              )}
            </div>
          ))}
          <div>
            <Button variant="outline" size="sm" onClick={startAdd}>Add Style</Button>
          </div>
        </CardContent>
      </Card>

      {editing && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{styles.find(s => s.id === editing.id) ? 'Edit Style' : 'Add Style'}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-xs text-gray-600 mb-1">Name</div>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Kawaii Retro 1 - Custom" />
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Concise Label (optional)</div>
              <Input value={editing.label || ''} onChange={(e) => setEditing({ ...editing, label: e.target.value })} placeholder="Kawaii retro vector illustration" />
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Details (guidance)</div>
              <Textarea value={editing.details || ''} onChange={(e) => setEditing({ ...editing, details: e.target.value })} placeholder="Detailed guidance text added to prompts" className="min-h-24" />
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Tags (comma separated)</div>
              <Input value={(editing.tags || []).join(', ')} onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} placeholder="design, image, mockup" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

