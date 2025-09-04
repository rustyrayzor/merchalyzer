"use client";
import { useState, useRef, KeyboardEvent, ClipboardEvent, ChangeEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

export interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  maxTags?: number;
  onTagClick?: (tag: string) => void;
}

export default function TagInput({ value, onChange, placeholder, disabled, maxTags, onTagClick }: TagInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const addTag = (raw: string) => {
    let t = (raw || '').trim();
    if (!t) return;
    // strip trailing comma(s)
    t = t.replace(/,+$/, '').trim();
    if (!t) return;
    const exists = new Set(value.map(v => v.toLowerCase()));
    if (exists.has(t.toLowerCase())) return;
    if (maxTags && value.length >= maxTags) return;
    onChange([...value, t]);
  };

  const removeTag = (idx: number) => {
    const next = value.slice(0, idx).concat(value.slice(idx + 1));
    onChange(next);
  };

  const commitIfAny = () => {
    if (text.trim()) {
      addTag(text);
      setText('');
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === ',' || e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      commitIfAny();
    } else if (e.key === 'Backspace' && text.length === 0 && value.length > 0) {
      // Backspace with empty input removes last tag
      e.preventDefault();
      removeTag(value.length - 1);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const data = e.clipboardData.getData('text');
    if (data && (data.includes(',') || /\s/.test(data))) {
      e.preventDefault();
      const parts = data.split(/[,\n\r\t]+/).map(s => s.trim()).filter(Boolean);
      const exists = new Set(value.map(v => v.toLowerCase()));
      const next: string[] = [...value];
      for (const p of parts) {
        const key = p.toLowerCase();
        if (!exists.has(key) && (!maxTags || next.length < maxTags)) {
          next.push(p);
          exists.add(key);
        }
      }
      onChange(next);
    }
  };

  const onChangeText = (e: ChangeEvent<HTMLInputElement>) => setText(e.target.value);

  return (
    <div className="flex flex-wrap items-center gap-2 border rounded-md p-2">
      {value.map((t, idx) => (
        <Badge key={`${t}-${idx}`} variant="secondary" className="flex items-center gap-1">
          <span
            className={onTagClick ? 'cursor-pointer hover:underline' : undefined}
            onClick={() => { if (onTagClick) onTagClick(t); }}
            title={onTagClick ? 'Use this tag' : undefined}
          >
            {t}
          </span>
          {!disabled && (
            <button type="button" onClick={() => removeTag(idx)} aria-label={`Remove ${t}`}>
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
      <input
        ref={inputRef}
        className="flex-1 min-w-[120px] outline-none bg-transparent text-sm"
        placeholder={placeholder || 'Type a tag and press comma'}
        value={text}
        onChange={onChangeText}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={commitIfAny}
        disabled={disabled}
      />
    </div>
  );
}
