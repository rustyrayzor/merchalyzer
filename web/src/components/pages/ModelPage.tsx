import { useState, useEffect } from "react";
import InputsPanel from "@/components/InputsPanel";
import { loadDefaultModel, loadDefaultBrand, loadDefaultKeywords, saveDefaultModel } from "@/lib/storage";
import { cn } from "@/lib/utils";

export default function ModelPage() {
  const [model, setModel] = useState("openrouter/auto");
  const [instructions, setInstructions] = useState("");
  const [brand, setBrand] = useState("");
  const [keywords, setKeywords] = useState("");
  const [isVisible, setIsVisible] = useState(false);

  // Load saved defaults on component mount
  useEffect(() => {
    const savedModel = loadDefaultModel();
    if (savedModel) {
      setModel(savedModel);
    }

    const savedBrand = loadDefaultBrand();
    if (savedBrand) {
      setBrand(savedBrand);
    }

    const savedKeywords = loadDefaultKeywords();
    if (savedKeywords) {
      setKeywords(savedKeywords);
    }

    // Trigger entrance animation
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
        "transition-all duration-500 ease-out delay-100",
        isVisible ? "opacity-100 transform translate-y-0" : "opacity-0 transform translate-y-4"
      )}>
        <InputsPanel
          model={model}
          instructions={instructions}
          brand={brand}
          keywords={keywords}
          onChange={(next) => {
            if (next.model !== undefined) {
              setModel(next.model);
              // Persist selection so Workflow generation picks it up
              saveDefaultModel(next.model);
            }
            if (next.instructions !== undefined) setInstructions(next.instructions);
            if (next.brand !== undefined) setBrand(next.brand);
            if (next.keywords !== undefined) setKeywords(next.keywords);
          }}
          showModelSection={true}
          showInstructionsSection={false}
          showBrandKeywords={false}
          showInstructionTemplates={false}
        />
      </div>
    </main>
  );
}
