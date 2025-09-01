import { useMemo, useState, useEffect } from "react";
import Uploader from "@/components/Uploader";
import EditorModelSelector from "@/components/EditorModelSelector";
import { cn } from "@/lib/utils";
import type { EditImageRequest, ImageEditItem, ImageEditInstruction, ImageEditOutput } from "@/lib/types";

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function EditPage() {
  const [items, setItems] = useState<ImageEditItem[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [model, setModel] = useState("google/gemini-2.5-flash-image-preview:free");
  const [pendingInstruction, setPendingInstruction] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const hasAnyOutput = useMemo(() => items.some((it) => it.outputs.length > 0), [items]);

  const onFiles = (files: File[]) => {
    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        setItems((prev) => [
          ...prev,
          {
            imageName: f.name,
            originalBase64: dataUrl,
            instructions: [],
            outputs: [],
          },
        ]);
        setImageUrls((prev) => ({ ...prev, [f.name]: URL.createObjectURL(f) }));
      };
      reader.readAsDataURL(f);
    });
  };

  async function runEdit(imageName: string) {
    const item = items.find((it) => it.imageName === imageName);
    if (!item) return;
    const text = (pendingInstruction[imageName] || "").trim();
    if (!text) return;
    setIsProcessing((prev) => ({ ...prev, [imageName]: true }));
    const instruction: ImageEditInstruction = { id: uid(), text, createdAt: Date.now() };
    try {
      const body: EditImageRequest = {
        model,
        imageName: item.imageName,
        originalBase64: item.originalBase64,
        instruction: instruction.text,
      };
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errText = await res.text();
        try {
          const parsed = JSON.parse(errText) as { error?: string };
          alert(parsed.error || errText);
        } catch {
          alert(errText);
        }
        return;
      }
      const data = await res.json() as { base64DataUrl: string };
      const output: ImageEditOutput = { id: uid(), base64DataUrl: data.base64DataUrl, fromInstructionId: instruction.id, createdAt: Date.now() };
      setItems((prev) => prev.map((it) => it.imageName === imageName ? {
        ...it,
        instructions: [...it.instructions, instruction],
        outputs: [...it.outputs, output],
      } : it));
      setPendingInstruction((prev) => ({ ...prev, [imageName]: "" }));
    } finally {
      setIsProcessing((prev) => ({ ...prev, [imageName]: false }));
    }
  }

  function undoLast(imageName: string) {
    setItems((prev) => prev.map((it) => {
      if (it.imageName !== imageName) return it;
      if (it.outputs.length === 0) return it;
      const nextOutputs = it.outputs.slice(0, -1);
      const lastOutput = it.outputs[it.outputs.length - 1];
      const nextInstructions = it.instructions.filter((ins) => ins.id !== lastOutput.fromInstructionId);
      return { ...it, outputs: nextOutputs, instructions: nextInstructions };
    }));
  }

  function deleteOutput(imageName: string, outputId: string) {
    setItems((prev) => prev.map((it) => {
      if (it.imageName !== imageName) return it;
      const removed = it.outputs.find((o) => o.id === outputId);
      const nextOutputs = it.outputs.filter((o) => o.id !== outputId);
      const nextInstructions = removed ? it.instructions.filter((ins) => ins.id !== removed.fromInstructionId) : it.instructions;
      return { ...it, outputs: nextOutputs, instructions: nextInstructions };
    }));
  }

  function replaceInstruction(imageName: string, instructionId: string, nextText: string) {
    setItems((prev) => prev.map((it) => {
      if (it.imageName !== imageName) return it;
      return { ...it, instructions: it.instructions.map((ins) => ins.id === instructionId ? { ...ins, text: nextText } : ins) };
    }));
  }

  async function reRunInstruction(imageName: string, instructionId: string) {
    const item = items.find((it) => it.imageName === imageName);
    if (!item) return;
    const ins = item.instructions.find((i) => i.id === instructionId);
    if (!ins) return;
    const text = (ins.text || '').trim();
    if (!text) return;
    setIsProcessing((prev) => ({ ...prev, [imageName]: true }));
    try {
      const body: EditImageRequest = {
        model,
        imageName: item.imageName,
        originalBase64: item.originalBase64,
        instruction: text,
      };
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errText = await res.text();
        try {
          const parsed = JSON.parse(errText) as { error?: string };
          alert(parsed.error || errText);
        } catch {
          alert(errText);
        }
        return;
      }
      const data = await res.json() as { base64DataUrl: string };
      setItems((prev) => prev.map((it) => {
        if (it.imageName !== imageName) return it;
        const idx = it.outputs.findIndex((o) => o.fromInstructionId === instructionId);
        if (idx === -1) {
          const newOutput: ImageEditOutput = { id: uid(), base64DataUrl: data.base64DataUrl, fromInstructionId: instructionId, createdAt: Date.now() };
          return { ...it, outputs: [...it.outputs, newOutput] };
        }
        const nextOutputs = it.outputs.slice();
        nextOutputs[idx] = { ...nextOutputs[idx], base64DataUrl: data.base64DataUrl, createdAt: Date.now() };
        return { ...it, outputs: nextOutputs };
      }));
    } finally {
      setIsProcessing((prev) => ({ ...prev, [imageName]: false }));
    }
  }

  function downloadDataUrl(dataUrl: string, filename: string) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function downloadAll() {
    // For minimal implementation, trigger sequential downloads
    items.forEach((it) => {
      it.outputs.forEach((o, idx) => downloadDataUrl(o.base64DataUrl, `${it.imageName.replace(/\.[^.]+$/, '')}.edit${idx + 1}.png`));
    });
  }

  return (
    <main className={cn(
      "space-y-6 transition-all duration-500 ease-out",
      isVisible ? "opacity-100 transform translate-y-0" : "opacity-0 transform translate-y-4"
    )}>
      <section className={cn(
        "space-y-3 transition-all duration-500 ease-out delay-100",
        isVisible ? "opacity-100 transform translate-y-0" : "opacity-0 transform translate-y-4"
      )}>
        <EditorModelSelector model={model} onModelChange={setModel} />
        <Uploader onFiles={onFiles} />
        {hasAnyOutput && (
          <div className="flex gap-2">
            <button
              className="px-3 py-2 rounded bg-gray-700 text-white hover:bg-gray-800 transition-all duration-200 hover:scale-105"
              onClick={downloadAll}
            >
              Download all outputs
            </button>
          </div>
        )}
      </section>

      <section className={cn(
        "space-y-6 transition-all duration-500 ease-out delay-200",
        isVisible ? "opacity-100 transform translate-y-0" : "opacity-0 transform translate-y-4"
      )}>
        {items.map((it, index) => (
          <div key={it.imageName} className={cn(
            "border rounded p-3 bg-white transition-all duration-500 ease-out",
            isVisible ? "opacity-100 transform translate-y-0" : "opacity-0 transform translate-y-4"
          )} style={{ transitionDelay: `${300 + index * 100}ms` }}>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="sm:w-1/3">
                <img // eslint-disable-line @next/next/no-img-element
                  src={imageUrls[it.imageName]}
                  alt={it.imageName}
                  className="w-full h-auto rounded border transition-transform duration-300 hover:scale-105" />
                <div className="mt-2 text-xs text-gray-500 truncate" title={it.imageName}>{it.imageName}</div>
              </div>
              <div className="sm:flex-1 flex flex-col gap-3">
                <div className="flex gap-2">
                  <input
                    className="border rounded p-2 flex-1 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe the edit you want"
                    value={pendingInstruction[it.imageName] || ""}
                    onChange={(e) => setPendingInstruction((prev) => ({ ...prev, [it.imageName]: e.target.value }))}
                  />
                  <button
                    className={`px-3 py-2 rounded text-white transition-all duration-200 hover:scale-105 active:scale-95 ${isProcessing[it.imageName] ? 'bg-blue-500/70 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                    disabled={isProcessing[it.imageName] || !(pendingInstruction[it.imageName] || '').trim()}
                    onClick={() => runEdit(it.imageName)}
                  >
                    {isProcessing[it.imageName] ? 'Editing…' : 'Run edit'}
                  </button>
                  <button
                    className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 transition-all duration-200 hover:scale-105 active:scale-95"
                    disabled={it.outputs.length === 0}
                    onClick={() => undoLast(it.imageName)}
                  >
                    Undo last
                  </button>
                </div>

                {it.instructions.length > 0 && (
                  <div className="text-sm">
                    <div className="text-gray-600 mb-1">Instructions history</div>
                    <ul className="space-y-2">
                      {it.instructions.map((ins) => (
                        <li key={ins.id} className="flex items-start gap-2">
                          <textarea
                            className="border rounded p-2 flex-1 min-h-10 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={ins.text}
                            onChange={(e) => replaceInstruction(it.imageName, ins.id, e.target.value)}
                          />
                          <button
                            className={`px-3 py-1 rounded text-white transition-all duration-200 hover:scale-105 active:scale-95 ${isProcessing[it.imageName] ? 'bg-blue-500/70 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                            disabled={isProcessing[it.imageName]}
                            onClick={() => reRunInstruction(it.imageName, ins.id)}
                          >
                            Re-run
                          </button>
                          <span className="text-xs text-gray-500 whitespace-nowrap pt-2">{new Date(ins.createdAt).toLocaleTimeString()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {it.outputs.length > 0 && (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {it.outputs.map((o, idx) => (
                      <div key={o.id} className="border rounded p-2 transition-all duration-300 hover:shadow-md hover:scale-105">
                        <img // eslint-disable-line @next/next/no-img-element
                          src={o.base64DataUrl}
                          alt={`Edit ${idx + 1}`}
                          className="w-full h-auto rounded transition-transform duration-300 hover:scale-105" />
                        <div className="flex gap-2 mt-2">
                          <button
                            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 transition-all duration-200 hover:scale-105 active:scale-95"
                            onClick={() => downloadDataUrl(o.base64DataUrl, `${it.imageName.replace(/\.[^.]+$/, '')}.edit${idx + 1}.png`)}
                          >
                            Download
                          </button>
                          <button
                            className="px-3 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-all duration-200 hover:scale-105 active:scale-95"
                            onClick={() => deleteOutput(it.imageName, o.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
