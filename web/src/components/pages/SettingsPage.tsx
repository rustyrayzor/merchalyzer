import { useState, useEffect } from "react";
import InputsPanel from "@/components/InputsPanel";
import { GLOBAL_SYSTEM_PROMPT } from "@/lib/prompts";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [model, setModel] = useState("openrouter/auto");
  const [instructions, setInstructions] = useState("");
  const [brand, setBrand] = useState("");
  const [keywords, setKeywords] = useState("");
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <main className={cn(
      "space-y-6 transition-all duration-500 ease-out",
      isVisible ? "opacity-100 transform translate-y-0" : "opacity-0 transform translate-y-4"
    )}>
      <div className={cn(
        "border rounded p-3 bg-white transition-all duration-500 ease-out delay-100",
        isVisible ? "opacity-100 transform translate-y-0" : "opacity-0 transform translate-y-4"
      )}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">System Prompt (read-only)</span>
          <button
            className="px-2 py-1 text-sm rounded border bg-gray-50 hover:bg-gray-100 transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => navigator.clipboard.writeText(GLOBAL_SYSTEM_PROMPT)}
          >
            Copy
          </button>
        </div>
        <pre className="whitespace-pre-wrap text-xs text-gray-800 max-h-80 overflow-auto">{GLOBAL_SYSTEM_PROMPT}</pre>
      </div>
      <div className={cn(
        "transition-all duration-500 ease-out delay-200",
        isVisible ? "opacity-100 transform translate-y-0" : "opacity-0 transform translate-y-4"
      )}>
        <InputsPanel
          model={model}
          instructions={instructions}
          brand={brand}
          keywords={keywords}
          onChange={(next) => {
            if (next.model !== undefined) setModel(next.model);
            if (next.instructions !== undefined) setInstructions(next.instructions);
            if (next.brand !== undefined) setBrand(next.brand);
            if (next.keywords !== undefined) setKeywords(next.keywords);
          }}
          showModelSection={false}
          showInstructionsSection={true}
          showBrandKeywords={false}
          showInstructionTemplates={false}
        />
      </div>
    </main>
  );
}
