'use client';

import { useState, useCallback, useEffect } from 'react';
import { WorkflowImage } from '@/lib/types';
import { loadDefaultModel, loadWorkflowImages, saveWorkflowImages, clearWorkflowImages, checkStorageQuota, clearAllStorage, saveWorkflowImagesIndexedDB, loadWorkflowImagesIndexedDB, clearWorkflowImagesIndexedDB, getIndexedDBStorageInfo, clearProcessedFolder, loadBgRemovalProvider, loadUpscaleProvider, loadIdeogramUpscaleSettings } from '@/lib/storage';
import { createZipWithCsvAndImages, ImageData } from '@/lib/csv';
import { generateUUID } from '@/lib/utils';
import BatchToolbar from './BatchToolbar';
import ImageRow from './ImageRow';
import EditAIModal from './EditAIModal';
import ColorChangeModal from './ColorChangeModal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Trash2 } from 'lucide-react';

// Vision-capable models for text generation (ordered by preference)
const VISION_MODELS = [
  'openai/gpt-5-mini',                    // GPT-5 Mini (vision)
  'openai/gpt-4o-mini-2024-07-18',           // Primary fallback
  'openai/gpt-4o-2024-08-06',               // GPT-4o full
  'meta-llama/llama-4-maverick:free',       // Free Llama
  'google/gemini-2.5-flash-image-preview',  // Gemini
  'google/gemini-2.5-flash-image-preview:free', // Free Gemini
  'anthropic/claude-3.5-sonnet-20241022',   // Claude Sonnet
  'anthropic/claude-3.5-haiku-20241022',    // Claude Haiku
];

export default function ImageManager() {
  const [images, setImages] = useState<WorkflowImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedImageForEdit, setSelectedImageForEdit] = useState<WorkflowImage | null>(null);
  const [isColorChangeModalOpen, setIsColorChangeModalOpen] = useState(false);
  const [selectedImageForColorChange, setSelectedImageForColorChange] = useState<WorkflowImage | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [showClearAllStorageConfirmation, setShowClearAllStorageConfirmation] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [storageQuota, setStorageQuota] = useState<{ usage: number; available: number; warning: boolean } | null>(null);

  // Get the appropriate model for text generation
  const getGenerationModel = useCallback((): string => {
    // First try user's default model
    const userModel = loadDefaultModel();
    if (userModel) {
      console.log('🔧 User selected model:', userModel);

      // Check if it's a vision-capable model with improved detection
      const isVisionModel = VISION_MODELS.some(visionModel => {
        // Exact match
        if (userModel === visionModel) return true;

        // Contains model identifier (more robust)
        const modelId = visionModel.split('/')[1]?.split(':')[0]; // Handle versions like :free
        if (modelId && userModel.includes(modelId)) return true;

        // Special cases for common model names
        const commonNames = {
          'gpt-5-mini': ['gpt-5-mini', 'gpt5-mini', 'gpt5mini'],
          'gpt-5': ['gpt-5', 'gpt5'],
          'gpt-4o-mini': ['gpt-4o-mini', 'gpt4o-mini', 'gpt4omini'],
          'gpt-4o': ['gpt-4o', 'gpt4o'],
          'gemini': ['gemini', 'gemini-flash'],
          'llama': ['llama', 'llama-maverick'],
          'claude': ['claude', 'claude-sonnet']
        };

        for (const [key, variations] of Object.entries(commonNames)) {
          if (variations.some(v => userModel.toLowerCase().includes(v))) {
            return visionModel.toLowerCase().includes(key);
          }
        }

        return false;
      });

      console.log('👁️ Is vision model:', isVisionModel);

      if (isVisionModel) {
        console.log('✅ Using user-selected vision model:', userModel);
        return userModel;
      } else {
        console.log('⚠️ User model is not vision-capable, using fallback');
        console.log('📋 Available vision models:', VISION_MODELS);
      }
    } else {
      console.log('⚠️ No user model found, using fallback');
    }

    // Fallback to GPT-4o mini (first in preferred order)
    const fallbackModel = VISION_MODELS[0];
    console.log('🔄 Using fallback model:', fallbackModel);
    return fallbackModel;
  }, []);

  // Function to update storage quota information
  const updateStorageQuota = useCallback(async () => {
    try {
      const quota = await getIndexedDBStorageInfo();
      setStorageQuota({
        usage: quota.usage,
        available: quota.available,
        warning: quota.available < 50 // Warn when less than 50MB available
      });
    } catch (error) {
      console.warn('Could not get storage info, using fallback:', error);
      // Fallback to basic quota info
      const fallbackQuota = checkStorageQuota();
      setStorageQuota(fallbackQuota);
    }
  }, []);

  // Generate thumbnail for an image
  const generateThumbnail = useCallback((image: WorkflowImage) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Calculate thumbnail dimensions (max 150px) using natural size
        const maxSize = 150;
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        // Ensure canvas has transparent background
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const thumbnailUrl = canvas.toDataURL('image/png');

        setImages((prev) =>
          prev.map((img) =>
            img.id === image.id ? { ...img, thumbnailUrl } : img
          )
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(image.originalFile);
  }, []);

  // Handle file uploads
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newImages: WorkflowImage[] = Array.from(files).map((file) => ({
      id: generateUUID(),
      originalFile: file,
      status: 'pending',
      metadata: {
        brand: '',
        title: '',
        bullet1: '',
        bullet2: '',
        description: '',
      },
      processingSteps: {},
    }));

    setImages((prev) => [...prev, ...newImages]);

    // Generate thumbnails for new images
    newImages.forEach((image) => {
      generateThumbnail(image);
    });
  }, [generateThumbnail]);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  // Handle drag leave
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Filter for image files only
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      alert('Please drop only image files (PNG, JPG, JPEG)');
      return;
    }

    // Process the dropped files directly
    const newImages: WorkflowImage[] = imageFiles.map((file) => ({
      id: generateUUID(),
      originalFile: file,
      status: 'pending',
      metadata: {
        brand: '',
        title: '',
        bullet1: '',
        bullet2: '',
        description: '',
      },
      processingSteps: {},
    }));

    setImages((prev) => [...prev, ...newImages]);

    // Generate thumbnails for new images
    newImages.forEach((image) => {
      generateThumbnail(image);
    });
  }, [generateThumbnail]);

  // Load workflow data on component mount
  useEffect(() => {
    const loadWorkflowData = async () => {
      try {
        // Try IndexedDB first, fallback to localStorage if needed
        let savedImages = await loadWorkflowImagesIndexedDB();

        // If no IndexedDB data, try localStorage for migration
        if (savedImages.length === 0) {
          savedImages = await loadWorkflowImages();
          // If we found localStorage data, migrate it to IndexedDB
          if (savedImages.length > 0) {
            console.log('🔄 Migrating workflow data from localStorage to IndexedDB...');
            try {
              await saveWorkflowImagesIndexedDB(savedImages);
              console.log('✅ Migration completed');
            } catch (migrationError) {
              console.warn('Migration to IndexedDB failed, keeping data in localStorage:', migrationError);
            }
          }
        }

        if (savedImages.length > 0) {
          setImages(savedImages);
          // Generate thumbnails for any images missing them (e.g., imported via Workflow send)
          try {
            savedImages.forEach((img) => {
              if (!img.thumbnailUrl && img.originalFile) {
                generateThumbnail(img);
              }
            });
          } catch (e) {
            console.warn('Thumbnail generation skipped:', e);
          }
        }
      } catch (error) {
        console.error('Error loading workflow data:', error);
      } finally {
        setIsLoading(false);
        // Update storage quota after loading
        updateStorageQuota();
      }
    };

    loadWorkflowData();
  }, [updateStorageQuota, generateThumbnail]);

  // Save workflow data whenever images change
  useEffect(() => {
    if (!isLoading) {
      // Debounce saving to avoid excessive writes
      const timeoutId = setTimeout(async () => {
        try {
          // Try IndexedDB first, fallback to localStorage if IndexedDB fails
          try {
            await saveWorkflowImagesIndexedDB(images);
          } catch (indexedDBError) {
            console.warn('IndexedDB save failed, falling back to localStorage:', indexedDBError);
            // Fallback to localStorage if IndexedDB fails
            await saveWorkflowImages(images);
          }

          // Clear any previous storage errors on successful save
          setStorageError(null);
          // Update storage quota after saving
          updateStorageQuota();
        } catch (error) {
          console.error('Error saving workflow data:', error);
          if (error instanceof Error && (error.message.includes('Storage quota exceeded') || error.message.includes('quota'))) {
            setStorageError(`Storage limit reached. ${error.message}`);
          } else {
            setStorageError('Failed to save workflow data. Your changes may not persist.');
          }
          // Update storage quota even on error
          updateStorageQuota();
        }
      }, 500); // 500ms debounce

      return () => clearTimeout(timeoutId);
    }
  }, [images, isLoading, updateStorageQuota]);

  // Update image metadata
  const updateImageMetadata = useCallback((imageId: string, field: string, value: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === imageId
          ? {
              ...img,
              metadata: {
                ...img.metadata,
                [field]: value,
              },
            }
          : img
      )
    );
  }, []);

  // Copy a metadata field to all or selected images
  const broadcastMetadata = useCallback((field: 'brand' | 'keywords', value: string, scope: 'all' | 'selected') => {
    setImages((prev) =>
      prev.map((img) => {
        const shouldApply = scope === 'all' || selectedImages.has(img.id);
        if (!shouldApply) return img;
        return {
          ...img,
          metadata: {
            ...img.metadata,
            [field]: value,
          },
        };
      })
    );
  }, [selectedImages]);

  // Helper function to convert File to base64 data URL
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  // Process single image with a specific operation
  type ProcessSource = 'original' | 'processed';
  const processImage = useCallback(async (
    imageId: string,
    operation: string,
    opts?: { forceSource?: ProcessSource; sourceBlob?: Blob; sourceName?: string }
  ): Promise<{ url: string | null; blob: Blob } | null> => {
    const image = images.find((img) => img.id === imageId);
    if (!image) return null;

    // Handle edit-ai specially - open modal instead of processing immediately
    if (operation === 'edit-ai') {
      setSelectedImageForEdit(image);
      setIsEditModalOpen(true);
      return null;
    }

    // Handle color-change specially - open color picker modal instead of processing immediately
    if (operation === 'color-change') {
      setSelectedImageForColorChange(image);
      setIsColorChangeModalOpen(true);
      return null;
    }

    setImages((prev) =>
      prev.map((img) =>
        img.id === imageId ? { ...img, status: 'processing' } : img
      )
    );

    try {
      if (operation === 'generate') {
        // Handle text generation using the generate API
        const imageBase64 = await fileToBase64(image.originalFile);

        // Build dynamic instructions based on user input
        let instructions = '';

        // Title instructions - handle optional user-provided title
        if (image.metadata.title && image.metadata.title.trim()) {
          // User provided title - use it as foundation
          instructions += `USER-PROVIDED TITLE: "${image.metadata.title.trim()}". `;
          instructions += 'Use this exact title as the foundation for generating all other fields. ';
          instructions += 'Extract keywords and themes from this title to create brand, bullets, and description. ';
          instructions += 'Do NOT modify or add to the provided title - use it exactly as given.\n\n';
        } else {
          // No title provided - extract from image
          instructions += 'Design Title: FIRST, look for any TEXT, WORDS, or PHRASES that appear in the design/image itself. ';
          instructions += 'If there\'s text like "Just A Dad Who Came Back With Milk", START the title with those EXACT words. ';
          instructions += 'If no text, describe the main visual elements precisely. ';
          instructions += 'Then add relevant keywords that fit naturally within 60 characters. ';
          instructions += 'Examples: "Just A Dad Who Came Back With Milk Funny Design", "World\'s Best Dad Coffee Lover", "Sorry I\'m Late I Saw A Dog". ';
          if (image.metadata.keywords) {
            instructions += `Include these keywords: ${image.metadata.keywords}. `;
          }
          instructions += 'PRIORITY: Extract exact text from design first, then add keywords. No more than 60 characters. ';
          instructions += 'Do NOT include "T-Shirt", gift, shirt, tees, tshirt, t-shirt, art in the title.\n\n';
        }

        // Brand instructions - use provided brand if available
        if (image.metadata.brand) {
          instructions += `Brand: Use this brand name "${image.metadata.brand}". No more than 50 characters, make it keyword-rich if possible. Do NOT include "T-Shirt", gift, shirt, tees, tshirt, t-shirt.\n\n`;
        } else {
          instructions += 'Brand: No more than 50 characters, include relevant and keyword-rich. Do NOT include "T-Shirt", gift, shirt, tees, tshirt, t-shirt.\n\n';
        }

        // Bullet points instructions - extract exact design elements
        instructions += 'Feature Bullet 1: If the design has text, QUOTE the exact text or phrase that appears in the design. ';
        instructions += 'If no text, describe the main visual elements precisely. Focus on what makes this design unique and memorable. ';
        instructions += 'Example: "Features the hilarious phrase \'Just A Dad Who Came Back With Milk\' with cute dad character". Max 250 characters. ';
        instructions += 'Do NOT include "T-Shirt", gift, shirt, tees, tshirt, t-shirt.\n\n';
        instructions += 'Feature Bullet 2: Based on the design text/elements, describe who would love this and why. ';
        instructions += 'Example: "Perfect for dads who always forget the milk but come back with funny stories". ';
        instructions += 'Connect the specific design elements to the target audience. Max 250 characters. ';
        instructions += 'Do NOT include "T-Shirt", gift, shirt, tees, tshirt, t-shirt.\n\n';

        // Description instructions - extract exact design elements
        instructions += 'Product Description: FIRST, if the design has text, QUOTE the exact text or phrase that appears. ';
        instructions += 'Example: "This design proudly displays \'Just A Dad Who Came Back With Milk\' alongside a cartoon dad character". ';
        instructions += 'Then explain who would love this specific design and why. Make it personal and specific to the design elements. ';
        instructions += 'Flow naturally: describe the design → connect to audience → highlight benefits. ';
        if (image.metadata.keywords) {
          instructions += `Include these keywords: ${image.metadata.keywords}. `;
        }
        instructions += 'Max 512 characters. Use SEO optimized content. Use a friendly tone with light marketing flair. Do NOT include "T-Shirt", gift, shirt, tees, tshirt, t-shirt. Language: English only.';

        // Build payload with optional title
        const generatePayload: {
          imageName: string;
          instructions: string;
          model: string;
          imageBase64: string;
          mode: string;
          title?: string;
        } = {
          imageName: image.originalFile.name,
          instructions,
          model: getGenerationModel(),
          imageBase64,
          mode: 'row'
        };

        // Only include title if user provided one
        if (image.metadata.title && image.metadata.title.trim()) {
          generatePayload.title = image.metadata.title.trim();
        }

        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(generatePayload),
        });

        if (!response.ok) {
          throw new Error(`Generation failed: ${response.statusText}`);
        }

        // Debug: surface which model was actually used and prompt previews
        const modelUsed = response.headers.get('X-Model-Used') || '';
        const promptPreview = response.headers.get('X-User-Prompt-Preview') || '';
        const systemPreview = response.headers.get('X-System-Prompt-Preview') || '';
        if (modelUsed) console.log('🧠 Generation model used:', modelUsed);
        if (promptPreview) console.log('📝 Prompt preview:', promptPreview);
        if (systemPreview) console.log('⚙️ System prompt preview:', systemPreview);

        const data = await response.json();
        const generatedFields = data.fields;

        setImages((prev) =>
          prev.map((img) =>
            img.id === imageId
              ? {
                  ...img,
                  metadata: {
                    ...img.metadata,
                    brand: generatedFields.brand || img.metadata.brand,
                    title: generatedFields.title || img.metadata.title,
                    bullet1: generatedFields.bullet1 || img.metadata.bullet1,
                    bullet2: generatedFields.bullet2 || img.metadata.bullet2,
                    description: generatedFields.description || img.metadata.description,
                  },
                  status: 'done',
                  processingSteps: {
                    ...img.processingSteps,
                    generated: true,
                  },
                }
              : img
          )
        );
      } else {
        // Handle other operations (scale, remove-bg, upscale, invert)
        let endpoint = '';
        const formData = new FormData();

        // Choose source according to opts
        const wantProcessed = opts?.forceSource === 'processed';
        const wantOriginal = opts?.forceSource === 'original';
        const canUseProcessed = !!image.processedUrl && !wantOriginal;

        // Highest priority: explicit source blob (from previous step)
        if (opts?.sourceBlob) {
          const name = opts?.sourceName || image.originalFile.name;
          const fileFromBlob = new File([opts.sourceBlob], name, { type: opts.sourceBlob.type || 'image/png' });
          formData.append('image', fileFromBlob);
          console.log('📎 Using explicit source blob for operation');
        } else if (canUseProcessed || wantProcessed) {
          try {
            // Fetch the processed image as a blob
            const processedResponse = await fetch(image.processedUrl!);
            if (processedResponse.ok) {
              const processedBlob = await processedResponse.blob();

              // Create a new File object with the processed blob but preserve original filename
              const originalName = image.originalFile.name;
              const processedFile = new File([processedBlob], originalName, { type: processedBlob.type });

              formData.append('image', processedFile);
              console.log('📎 Using processed image for next operation');
            } else {
              // Fallback to original if processed image fetch fails
              formData.append('image', image.originalFile);
              console.log('⚠️ Processed image fetch failed, using original');
            }
          } catch (error) {
            // Fallback to original if there's any error
            formData.append('image', image.originalFile);
            console.log('⚠️ Error fetching processed image, using original:', error);
          }
        } else {
          // No processed image available, use original
          formData.append('image', image.originalFile);
          console.log('📎 Using original image for operation');
        }

        switch (operation) {
          case 'scale':
            endpoint = '/api/workflow/scale';
            break;
          case 'remove-bg':
            {
              const provider = loadBgRemovalProvider();
              endpoint = `/api/workflow/remove-bg?provider=${encodeURIComponent(provider || 'pixelcut')}`;
            }
            break;
          case 'upscale':
            {
              const provider = loadUpscaleProvider();
              endpoint = `/api/workflow/upscale?provider=${encodeURIComponent(provider || 'ideogram')}`;
              if (provider === 'ideogram') {
                const s = loadIdeogramUpscaleSettings();
                if (typeof s.resemblance === 'number') formData.append('ideo_resemblance', String(s.resemblance));
                if (typeof s.detail === 'number') formData.append('ideo_detail', String(s.detail));
                if (typeof s.magic_prompt_option === 'string') formData.append('ideo_magic_prompt', s.magic_prompt_option);
                if (typeof s.seed === 'number') formData.append('ideo_seed', String(s.seed));
              }
            }
            break;
          case 'color-change':
            endpoint = '/api/workflow/color-change';
            break;
          case 'invert':
            endpoint = '/api/workflow/invert';
            break;
          default:
            throw new Error('Unknown operation');
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Processing failed: ${response.statusText}`);
        }

        // Get the processed image URL from the response header
        const processedUrl = response.headers.get('X-Processed-Url');

        // Also get the blob for immediate display
        const processedBlob = await response.blob();
        const blobUrl = URL.createObjectURL(processedBlob);

        const stepKey = (() => {
          switch (operation) {
            case 'remove-bg': return 'backgroundRemoved';
            case 'upscale': return 'upscaled';
            case 'scale': return 'scaled';
            case 'color-change': return 'colorChanged';
            case 'invert': return 'inverted';
            default: return (operation as string).replace('-', '');
          }
        })();

        setImages((prev) => prev.map((img) => {
          if (img.id !== imageId) return img;
          const prevUrl = img.processedUrl || '';
          const history = Array.isArray(img.history) ? img.history.slice() : [];
          const historySteps = Array.isArray(img.historySteps) ? img.historySteps.slice() : [];
          history.push(prevUrl);
          historySteps.push(stepKey);
          return {
            ...img,
            processedUrl: processedUrl || blobUrl, // Use HTTP URL if available, fallback to blob
            status: 'done',
            processingSteps: { ...img.processingSteps, [stepKey]: true },
            history,
            historySteps,
          };
        }));

        return { url: processedUrl, blob: processedBlob };
      }
    } catch (error) {
      console.error(`Error processing image ${operation}:`, error);
      setImages((prev) =>
        prev.map((img) =>
          img.id === imageId
            ? {
                ...img,
                status: 'error',
                error: error instanceof Error ? error.message : 'Processing failed',
              }
            : img
        )
      );
      return null;
    }
    return null;
  }, [images, fileToBase64, getGenerationModel]);

  const undoLast = useCallback((imageId: string) => {
    setImages((prev) => prev.map((img) => {
      if (img.id !== imageId) return img;
      const history = Array.isArray(img.history) ? img.history.slice() : [];
      const historySteps = Array.isArray(img.historySteps) ? img.historySteps.slice() : [];
      if (history.length === 0) {
        return { ...img, processedUrl: undefined, status: 'pending' };
      }
      const prevUrl = history.pop();
      const lastStep = historySteps.pop();
      const nextSteps: import('../lib/types').WorkflowImage['processingSteps'] = { ...img.processingSteps };
      type StepKey = keyof typeof nextSteps;
      if (lastStep) {
        const stepKey = lastStep as StepKey;
        if (stepKey in nextSteps) {
          nextSteps[stepKey] = false;
        }
      }
      return {
        ...img,
        processedUrl: prevUrl || undefined,
        status: prevUrl ? 'done' : 'pending',
        processingSteps: nextSteps,
        history,
        historySteps,
      };
    }));
  }, []);

  const revertToOriginal = useCallback((imageId: string) => {
    setImages((prev) => prev.map((img) => (
      img.id === imageId
        ? {
            ...img,
            processedUrl: undefined,
            status: 'pending',
            processingSteps: {},
            history: [],
            historySteps: [],
          }
        : img
    )));
  }, []);

  const fullProcess = useCallback(async (imageId: string) => {
    // Step 1: Upscale ORIGINAL
    let step1: { url: string | null; blob: Blob } | null = null;
    try { step1 = await processImage(imageId, 'upscale', { forceSource: 'original' }); } catch {}

    // Step 2: Remove BG from UPSCALED
    let step2: { url: string | null; blob: Blob } | null = null;
    try { if (step1) step2 = await processImage(imageId, 'remove-bg', { sourceBlob: step1.blob, sourceName: 'upscaled.png' }); }
    catch {}

    // Step 3: Scale the BG-REMOVED result
    try { if (step2) await processImage(imageId, 'scale', { sourceBlob: step2.blob, sourceName: 'removed_bg.png' }); }
    catch {}
  }, [processImage]);

  // Batch process all selected images
  const batchProcess = useCallback(async (operation: string) => {
    const selectedIds = Array.from(selectedImages);
    await Promise.all(
      selectedIds.map((id) => processImage(id, operation))
    );
  }, [selectedImages, processImage]);

  // Delete image
  const deleteImage = useCallback((imageId: string) => {
    setImages((prev) => prev.filter((img) => img.id !== imageId));
    setSelectedImages((prev) => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      return newSet;
    });
  }, []);

  // Download all images and CSV as ZIP
  const downloadAllAsZip = useCallback(async () => {
    if (images.length === 0) return;

    try {
      const rowData = images.map((image, index) => {
        const batchNumber = (index + 1).toString().padStart(3, '0'); // 001, 002, etc.

        // Use title for image name, fallback to generic name if empty
        let title = image.metadata.title?.trim() || `Untitled-${batchNumber}`;

        // Sanitize title for filename (remove invalid characters)
        title = title.replace(/[^a-zA-Z0-9\s\-_]/g, '').replace(/\s+/g, '-');

        // Limit length to avoid overly long filenames
        if (title.length > 50) {
          title = title.substring(0, 50);
        }

        const imageFilename = `${title}-${batchNumber}.png`;

        return {
          imageName: imageFilename,
          brand: image.metadata.brand || '',
          title: image.metadata.title || '',
          bullet1: image.metadata.bullet1 || '',
          bullet2: image.metadata.bullet2 || '',
          description: image.metadata.description || '',
        };
      });

      const imageData: ImageData[] = images.map((image) => ({
        title: image.metadata.title || '',
        processedUrl: image.processedUrl,
        thumbnailUrl: image.thumbnailUrl,
        originalFile: image.originalFile,
        processingSteps: image.processingSteps,
      }));

      const timestamp = new Date().toISOString().slice(0, 10);
      const baseFilename = `amazon-merch-workflow-${timestamp}`;

      await createZipWithCsvAndImages(rowData, imageData, baseFilename);
    } catch (error) {
      console.error('Error creating ZIP file:', error);
      alert('Failed to create ZIP file. Please try again.');
    }
  }, [images]);

  // Toggle image selection
  const toggleSelection = useCallback((imageId: string) => {
    setSelectedImages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  }, []);

  // Toggle select all images
  const toggleSelectAll = useCallback(() => {
    setSelectedImages((prev) => {
      const allSelected = prev.size === images.length;
      if (allSelected) {
        // Deselect all
        return new Set<string>();
      } else {
        // Select all
        return new Set(images.map(img => img.id));
      }
    });
  }, [images]);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setIsEditModalOpen(false);
    setSelectedImageForEdit(null);
  }, []);

  // Handle clear all confirmation
  const handleClearAllConfirm = useCallback(async () => {
    try {
      // Clear all state
      setImages([]);
      setSelectedImages(new Set());
      setSelectedImageForEdit(null);
      setIsEditModalOpen(false);
      setStorageError(null); // Clear any storage errors

      // Clear IndexedDB first, then localStorage as fallback
      try {
        await clearWorkflowImagesIndexedDB();
      } catch (indexedDBError) {
        console.warn('IndexedDB clear failed, falling back to localStorage:', indexedDBError);
        await clearWorkflowImages();
      }

      // Clear processed folder
      try {
        await clearProcessedFolder();
      } catch (processedError) {
        console.warn('Failed to clear processed folder:', processedError);
        // Don't fail the entire operation if processed folder clear fails
      }

      // Update storage quota after clearing
      updateStorageQuota();

      // Close confirmation modal
      setShowClearConfirmation(false);
    } catch (error) {
      console.error('Error clearing workflow:', error);
    }
  }, [updateStorageQuota]);

  // Handle clear all cancel
  const handleClearAllCancel = useCallback(() => {
    setShowClearConfirmation(false);
  }, []);

  // Handle clear all storage confirmation
  const handleClearAllStorageConfirm = useCallback(async () => {
    try {
      // Clear IndexedDB workflow data
      try {
        await clearWorkflowImagesIndexedDB();
      } catch (indexedDBError) {
        console.warn('IndexedDB clear failed:', indexedDBError);
      }

      // Clear all localStorage (including settings and other data)
      clearAllStorage();

      // Clear processed folder
      try {
        await clearProcessedFolder();
      } catch (processedError) {
        console.warn('Failed to clear processed folder:', processedError);
        // Don't fail the entire operation if processed folder clear fails
      }

      // Clear all workflow state
      setImages([]);
      setSelectedImages(new Set());
      setSelectedImageForEdit(null);
      setIsEditModalOpen(false);
      setStorageError(null);

      // Update storage quota after clearing
      updateStorageQuota();

      // Close confirmation modal
      setShowClearAllStorageConfirmation(false);
    } catch (error) {
      console.error('Error clearing all storage:', error);
    }
  }, [updateStorageQuota]);

  // Handle clear all storage cancel
  const handleClearAllStorageCancel = useCallback(() => {
    setShowClearAllStorageConfirmation(false);
  }, []);

  // Handle proceeding with edited image
  const handleProceedWithEditedImage = useCallback((editedImageUrl: string) => {
    if (!selectedImageForEdit) return;

    setImages((prev) => prev.map((img) => {
      if (img.id !== selectedImageForEdit.id) return img;
      const prevUrl = img.processedUrl || '';
      const history = Array.isArray(img.history) ? img.history.slice() : [];
      const historySteps = Array.isArray(img.historySteps) ? img.historySteps.slice() : [];
      history.push(prevUrl);
      historySteps.push('aiEdited');
      return {
        ...img,
        processedUrl: editedImageUrl,
        status: 'done',
        processingSteps: { ...img.processingSteps, aiEdited: true },
        history,
        historySteps,
      };
    }));
  }, [selectedImageForEdit]);

  // Handle color change processing
  const handleColorChange = useCallback(async (
    targetColor: string,
    replacementColor: string,
    tolerance: number = 30,
    selectionRects?: Array<{ id: string; x: number; y: number; width: number; height: number }>,
    selectionPolygons?: Array<{ id: string; points: Array<{ x: number; y: number }> }>,
    fullColorReplacement?: boolean,
    replaceWithTransparent?: boolean,
    paintMaskDataUrl?: string | null
  ) => {
    if (!selectedImageForColorChange) return;

    setImages((prev) =>
      prev.map((img) =>
        img.id === selectedImageForColorChange.id ? { ...img, status: 'processing' } : img
      )
    );

    try {
      const formData = new FormData();

      // Use processed image if available, otherwise use original
      if (selectedImageForColorChange.processedUrl) {
        try {
          // Fetch the processed image as a blob
          const processedResponse = await fetch(selectedImageForColorChange.processedUrl);
          if (processedResponse.ok) {
            const processedBlob = await processedResponse.blob();

            // Create a new File object with the processed blob but preserve original filename
            const originalName = selectedImageForColorChange.originalFile.name;
            const processedFile = new File([processedBlob], originalName, { type: processedBlob.type });

            formData.append('image', processedFile);
            console.log('📎 Using processed image for color change');
          } else {
            // Fallback to original if processed image fetch fails
            formData.append('image', selectedImageForColorChange.originalFile);
            console.log('⚠️ Processed image fetch failed, using original');
          }
        } catch (error) {
          // Fallback to original if there's any error
          formData.append('image', selectedImageForColorChange.originalFile);
          console.log('⚠️ Error fetching processed image, using original:', error);
        }
      } else {
        // No processed image available, use original
        formData.append('image', selectedImageForColorChange.originalFile);
        console.log('📎 Using original image for color change');
      }

      formData.append('targetColor', targetColor);
      formData.append('replacementColor', replacementColor);
      formData.append('tolerance', tolerance.toString());
      formData.append('fullColorReplacement', fullColorReplacement ? 'true' : 'false');
      formData.append('replaceWithTransparent', replaceWithTransparent ? 'true' : 'false');

      // Add selection rectangles if provided
      if (selectionRects && selectionRects.length > 0) {
        selectionRects.forEach((rect, index) => {
          formData.append(`selectionX${index}`, rect.x.toString());
          formData.append(`selectionY${index}`, rect.y.toString());
          formData.append(`selectionWidth${index}`, rect.width.toString());
          formData.append(`selectionHeight${index}`, rect.height.toString());
        });
        formData.append('selectionCount', selectionRects.length.toString());
      }

      // Add polygon selections if provided
      if (selectionPolygons && selectionPolygons.length > 0) {
        formData.append('polygonCount', selectionPolygons.length.toString());
        selectionPolygons.forEach((poly, pIndex) => {
          const pts = poly.points || [];
          formData.append(`polygon${pIndex}PointCount`, pts.length.toString());
          pts.forEach((pt, i) => {
            formData.append(`polygon${pIndex}x${i}`, pt.x.toString());
            formData.append(`polygon${pIndex}y${i}`, pt.y.toString());
          });
        });
      }

      // Add paint mask if provided (PNG data URL)
      if (paintMaskDataUrl) {
        try {
          const res = await fetch(paintMaskDataUrl);
          const blob = await res.blob();
          const file = new File([blob], 'mask.png', { type: 'image/png' });
          formData.append('mask', file);
        } catch {}
      }

      const response = await fetch('/api/workflow/color-change', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Color change failed: ${response.statusText}`);
      }

      // Get the processed image URL from the response header
      const processedUrl = response.headers.get('X-Processed-Url');

      // Also get the blob for immediate display
      const processedBlob = await response.blob();
      const blobUrl = URL.createObjectURL(processedBlob);

      setImages((prev) =>
        prev.map((img) =>
          img.id === selectedImageForColorChange.id
            ? {
                ...img,
                processedUrl: processedUrl || blobUrl,
                status: 'done',
                processingSteps: {
                  ...img.processingSteps,
                  colorChanged: true,
                },
              }
            : img
        )
      );

      // Close the modal
      setIsColorChangeModalOpen(false);
      setSelectedImageForColorChange(null);

    } catch (error) {
      console.error(`Error changing color:`, error);
      setImages((prev) =>
        prev.map((img) =>
          img.id === selectedImageForColorChange.id
            ? {
                ...img,
                status: 'error',
                error: error instanceof Error ? error.message : 'Color change failed',
              }
            : img
        )
      );
    }
  }, [selectedImageForColorChange]);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Storage Error Alert */}
      {storageError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">
                Storage Error
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{storageError}</p>
              </div>
              <div className="mt-4">
                <div className="-mx-2 -my-1.5 flex">
                  <button
                    onClick={() => setStorageError(null)}
                    className="bg-red-50 px-2 py-1.5 rounded-md text-sm font-medium text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={handleClearAllConfirm}
                    className="ml-3 bg-red-50 px-2 py-1.5 rounded-md text-sm font-medium text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600"
                  >
                    Clear Workflow
                  </button>
                </div>
              </div>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  onClick={() => setStorageError(null)}
                  className="inline-flex bg-red-50 rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Storage Usage Indicator */}
      {storageQuota && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Storage Usage</span>
            </div>
            <div className="text-sm text-gray-600">
              {storageQuota.usage.toFixed(2)}MB used of {(storageQuota.usage + storageQuota.available).toFixed(0)}MB available
            </div>
          </div>

          <div className="relative">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  storageQuota.warning
                    ? 'bg-red-500'
                    : storageQuota.usage > 500
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{
                  width: `${Math.min(100, ((storageQuota.usage / (storageQuota.usage + storageQuota.available)) * 100))}%`
                }}
              ></div>
            </div>

            {storageQuota.warning && (
              <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Storage nearly full</span>
              </div>
            )}

            {storageQuota.usage > 500 && !storageQuota.warning && (
              <div className="mt-2 flex items-center gap-1 text-xs text-yellow-600">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>High storage usage (&gt;500MB)</span>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>Used: {storageQuota.usage.toFixed(2)}MB</span>
            <span>Available: {storageQuota.available.toFixed(2)}MB</span>
          </div>

          <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
            <div className="flex items-start gap-1">
              <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Using IndexedDB for storage - supports much larger datasets (up to 1GB+). No more localStorage limitations!</span>
            </div>
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div className="mb-6">
        <Card className={`transition-all duration-200 ${isDragOver ? 'ring-2 ring-primary' : ''}`}>
          <CardContent className="p-6">
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center w-full h-32 cursor-pointer"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center justify-center">
                <Upload className={`w-8 h-8 mb-4 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="mb-2 text-sm">
                  <span className="font-semibold">
                    {isDragOver ? 'Drop your images here' : 'Click to upload'}
                  </span>{' '}
                  {!isDragOver && 'or drag and drop'}
                </p>
                <p className="text-xs text-muted-foreground">PNG, JPG, JPEG (MAX. 50MB)</p>
              </div>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
              />
            </label>
          </CardContent>
        </Card>
      </div>

      {/* Clear Buttons */}
      <div className="mb-4 flex justify-end gap-3">
        {/* Clear All Storage Button */}
        <Button
          onClick={() => setShowClearAllStorageConfirmation(true)}
          variant="outline"
          title="Clear all browser storage data"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear All Storage
        </Button>

        {/* Clear All Workflow Button */}
        {images.length > 0 && (
          <Button
            onClick={() => setShowClearConfirmation(true)}
            variant="destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        )}
      </div>

      {/* Batch Toolbar */}
      {images.length > 0 && (
        <BatchToolbar
          selectedCount={selectedImages.size}
          totalCount={images.length}
          onBatchProcess={batchProcess}
          onDownloadCsv={downloadAllAsZip}
          onToggleSelectAll={toggleSelectAll}
        />
      )}

      {/* Images List */}
      {images.length > 0 ? (
        <div className="space-y-4">
          {images.map((image) => (
            <ImageRow
              key={image.id}
              image={image}
              isSelected={selectedImages.has(image.id)}
              onSelect={toggleSelection}
              onProcess={(id, op) => {
                // Manual clicks: enforce desired chaining sources
                const map: Record<string, ProcessSource | undefined> = {
                  'upscale': 'original',
                  'remove-bg': 'processed',
                  'scale': 'processed',
                } as const;
                const src = map[op as keyof typeof map];
                return processImage(id, op, src ? { forceSource: src } : undefined);
              }}
              onUndo={undoLast}
              onRevert={revertToOriginal}
              onFullProcess={fullProcess}
              onDelete={deleteImage}
              onMetadataChange={updateImageMetadata}
              onBroadcastMetadata={broadcastMetadata}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">No images uploaded yet. Upload some images to get started.</p>
        </div>
      )}

      {/* Edit AI Modal */}
      {selectedImageForEdit && (
        <EditAIModal
          isOpen={isEditModalOpen}
          onClose={handleModalClose}
          onProceed={handleProceedWithEditedImage}
          originalImage={selectedImageForEdit}
        />
      )}

      {/* Color Change Modal */}
      {selectedImageForColorChange && (
        <ColorChangeModal
          isOpen={isColorChangeModalOpen}
          onClose={() => {
            setIsColorChangeModalOpen(false);
            setSelectedImageForColorChange(null);
          }}
          onProceed={handleColorChange}
          originalImage={selectedImageForColorChange}
        />
      )}

      {/* Clear All Confirmation Modal */}
      {showClearConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Clear All Images</h2>
                <button
                  onClick={handleClearAllCancel}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-600">
                  Are you sure you want to clear all images and reset your workflow?
                  This action cannot be undone.
                </p>
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    This will permanently delete all uploaded images, processing steps, and metadata.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleClearAllCancel}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAllConfirm}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors duration-200"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Storage Confirmation Modal */}
      {showClearAllStorageConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Clear All Storage</h2>
                <button
                  onClick={handleClearAllStorageCancel}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-600">
                  Are you sure you want to clear ALL browser storage data for this site?
                  This includes all settings, preferences, and cached data.
                </p>
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800">
                    ⚠️ This will clear ALL stored data for merchalyzer, including workflow images, model preferences, templates, and settings. This action cannot be undone.
                  </p>
                  <p className="text-xs text-red-700 mt-2">
                    Note: This clears both IndexedDB (high-capacity storage) and localStorage data. Your workflow will be completely reset.
                  </p>
                </div>
                {storageQuota && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800">
                      Current storage usage: <strong>{storageQuota.usage.toFixed(2)}MB</strong> of {(storageQuota.usage + storageQuota.available).toFixed(2)}MB available
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleClearAllStorageCancel}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAllStorageConfirm}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors duration-200"
                >
                  Clear All Storage
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
