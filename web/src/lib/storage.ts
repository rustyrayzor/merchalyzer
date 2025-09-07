import { ModelPreset, TemplateItem, WorkflowImage } from './types';

// IndexedDB Configuration
const DB_NAME = 'MerchalyzerDB';
const DB_VERSION = 1;
const WORKFLOW_STORE = 'workflows';
const METADATA_STORE = 'metadata';
const SETTINGS_STORE = 'settings';

const KEY = 'merchalyzer.templates.v1';
const MODEL_KEY = 'merchalyzer.modelpresets.v1';
const EDIT_MODEL_KEY = 'merchalyzer.edit.modelpresets.v1';
const DEFAULT_INSTR_KEY = 'merchalyzer.instructions.default.v1';
const DEFAULT_MODEL_KEY = 'merchalyzer.model.default.v1';
const DEFAULT_EDIT_MODEL_KEY = 'merchalyzer.edit.model.default.v1';
const DEFAULT_BRAND_KEY = 'merchalyzer.brand.default.v1';
const DEFAULT_KEYWORDS_KEY = 'merchalyzer.keywords.default.v1';
const DESIGN_MOCKUPS_SAVED_KEY = 'merchalyzer.designMockups.saved.v1';
const USER_STYLES_KEY = 'merchalyzer.userstyles.v1';

// IndexedDB Database Instance
let dbInstance: IDBDatabase | null = null;

// Initialize IndexedDB
async function initIndexedDB(): Promise<IDBDatabase> {
	if (dbInstance) {
		return dbInstance;
	}

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => {
			console.error('IndexedDB initialization failed');
			reject(new Error('Failed to initialize IndexedDB'));
		};

		request.onsuccess = () => {
			dbInstance = request.result;
			resolve(request.result);
		};

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;

			// Create object stores
			if (!db.objectStoreNames.contains(WORKFLOW_STORE)) {
				const workflowStore = db.createObjectStore(WORKFLOW_STORE, { keyPath: 'id' });
				workflowStore.createIndex('timestamp', 'timestamp', { unique: false });
			}

			if (!db.objectStoreNames.contains(METADATA_STORE)) {
				const metadataStore = db.createObjectStore(METADATA_STORE, { keyPath: 'id' });
				metadataStore.createIndex('timestamp', 'timestamp', { unique: false });
			}

			if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
				db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
			}
		};
	});
}

// NOTE: compression for workflow storage is not currently used.

// Decompress data
async function decompressData(compressedData: string): Promise<string> {
	try {
		if (typeof DecompressionStream !== 'undefined') {
			const stream = new DecompressionStream('gzip');
			const writer = stream.writable.getWriter();
			const reader = stream.readable.getReader();

			// Convert base64 to Uint8Array
			const binaryString = atob(compressedData);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}

			// Decompress
			writer.write(bytes);
			writer.close();

			const chunks: Uint8Array[] = [];
			let done = false;
			while (!done) {
				const { value, done: readerDone } = await reader.read();
				done = readerDone;
				if (value) chunks.push(value);
			}

			// Combine chunks and convert to string
			const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
			let offset = 0;
			for (const chunk of chunks) {
				decompressed.set(chunk, offset);
				offset += chunk.length;
			}

			const decoder = new TextDecoder();
			return decoder.decode(decompressed);
		}
	} catch (error) {
		console.warn('Decompression failed:', error);
	}

	// Fallback to assuming data is not compressed
	return compressedData;
}

export function loadTemplates(): TemplateItem[] {
	if (typeof window === 'undefined') {
		return [];
	}
	try {
		const raw = window.localStorage.getItem(KEY);
		if (!raw) {
			return [];
		}
		const parsed = JSON.parse(raw) as TemplateItem[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export function saveTemplate(newItem: TemplateItem): TemplateItem[] {
	const existing = loadTemplates();
	const merged = [newItem, ...existing.filter((t) => t.id !== newItem.id)];
	window.localStorage.setItem(KEY, JSON.stringify(merged));
	return merged;
}

export function deleteTemplate(id: string): TemplateItem[] {
	const existing = loadTemplates();
	const filtered = existing.filter((t) => t.id !== id);
	window.localStorage.setItem(KEY, JSON.stringify(filtered));
	return filtered;
}

export function loadModelPresets(): ModelPreset[] {
	if (typeof window === 'undefined') {
		return [];
	}
	try {
		const raw = window.localStorage.getItem(MODEL_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as ModelPreset[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export function saveModelPreset(preset: ModelPreset): ModelPreset[] {
	const existing = loadModelPresets();
	const merged = [preset, ...existing.filter((p) => p.id !== preset.id)];
	window.localStorage.setItem(MODEL_KEY, JSON.stringify(merged));
	return merged;
}

export function deleteModelPreset(id: string): ModelPreset[] {
	const existing = loadModelPresets();
	const filtered = existing.filter((p) => p.id !== id);
	window.localStorage.setItem(MODEL_KEY, JSON.stringify(filtered));
	return filtered;
}

// Editor-specific model presets (separate namespace)
export function loadEditModelPresets(): ModelPreset[] {
    if (typeof window === 'undefined') {
        return [];
    }
    try {
        const raw = window.localStorage.getItem(EDIT_MODEL_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as ModelPreset[];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function saveEditModelPreset(preset: ModelPreset): ModelPreset[] {
    const existing = loadEditModelPresets();
    const merged = [preset, ...existing.filter((p) => p.id !== preset.id)];
    window.localStorage.setItem(EDIT_MODEL_KEY, JSON.stringify(merged));
    return merged;
}

export function deleteEditModelPreset(id: string): ModelPreset[] {
    const existing = loadEditModelPresets();
    const filtered = existing.filter((p) => p.id !== id);
    window.localStorage.setItem(EDIT_MODEL_KEY, JSON.stringify(filtered));
    return filtered;
}

export function loadDefaultInstructions(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = window.localStorage.getItem(DEFAULT_INSTR_KEY);
		return raw ? String(raw) : null;
	} catch {
		return null;
	}
}

export function saveDefaultInstructions(value: string): string {
	window.localStorage.setItem(DEFAULT_INSTR_KEY, value);
	return value;
}

export function clearDefaultInstructions(): void {
	window.localStorage.removeItem(DEFAULT_INSTR_KEY);
}

export function loadDefaultModel(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = window.localStorage.getItem(DEFAULT_MODEL_KEY);
		return raw ? String(raw) : null;
	} catch {
		return null;
	}
}

export function saveDefaultModel(model: string): string {
	window.localStorage.setItem(DEFAULT_MODEL_KEY, model);
	return model;
}

export function clearDefaultModel(): void {
	window.localStorage.removeItem(DEFAULT_MODEL_KEY);
}

export function loadDefaultEditModel(): string | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(DEFAULT_EDIT_MODEL_KEY);
        return raw ? String(raw) : null;
    } catch {
        return null;
    }
}

export function saveDefaultEditModel(model: string): string {
    window.localStorage.setItem(DEFAULT_EDIT_MODEL_KEY, model);
    return model;
}

export function clearDefaultEditModel(): void {
    window.localStorage.removeItem(DEFAULT_EDIT_MODEL_KEY);
}

export function loadDefaultBrand(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = window.localStorage.getItem(DEFAULT_BRAND_KEY);
		return raw ? String(raw) : null;
	} catch {
		return null;
	}
}

export function saveDefaultBrand(value: string): string {
	window.localStorage.setItem(DEFAULT_BRAND_KEY, value);
	return value;
}

export function clearDefaultBrand(): void {
	window.localStorage.removeItem(DEFAULT_BRAND_KEY);
}

export function loadDefaultKeywords(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = window.localStorage.getItem(DEFAULT_KEYWORDS_KEY);
		return raw ? String(raw) : null;
	} catch {
		return null;
	}
}

export function saveDefaultKeywords(value: string): string {
	window.localStorage.setItem(DEFAULT_KEYWORDS_KEY, value);
	return value;
}

export function clearDefaultKeywords(): void {
    window.localStorage.removeItem(DEFAULT_KEYWORDS_KEY);
}

// Workflow storage functions
export type BgRemovalProvider = 'pixelcut' | 'rembg';
const BG_REMOVAL_PROVIDER_KEY = 'merchalyzer.workflow.bgremoval.provider.v1';

export function loadBgRemovalProvider(): BgRemovalProvider {
    if (typeof window === 'undefined') return 'pixelcut';
    try {
        const raw = window.localStorage.getItem(BG_REMOVAL_PROVIDER_KEY);
        return raw === 'rembg' || raw === 'pixelcut' ? (raw as BgRemovalProvider) : 'pixelcut';
    } catch {
        return 'pixelcut';
    }
}

export function saveBgRemovalProvider(value: BgRemovalProvider): BgRemovalProvider {
    if (typeof window !== 'undefined') {
        window.localStorage.setItem(BG_REMOVAL_PROVIDER_KEY, value);
    }
    return value;
}

export function clearBgRemovalProvider(): void {
    if (typeof window !== 'undefined') {
        window.localStorage.removeItem(BG_REMOVAL_PROVIDER_KEY);
    }
}

// Upscale provider (Upscayl by default, Ideogram optional)
export type UpscaleProvider = 'upscayl' | 'ideogram';
const UPSCALE_PROVIDER_KEY = 'merchalyzer.workflow.upscale.provider.v1';

export function loadUpscaleProvider(): UpscaleProvider {
    if (typeof window === 'undefined') return 'ideogram';
    try {
        const raw = window.localStorage.getItem(UPSCALE_PROVIDER_KEY);
        return raw === 'ideogram' || raw === 'upscayl' ? (raw as UpscaleProvider) : 'ideogram';
    } catch {
        return 'ideogram';
    }
}

export function saveUpscaleProvider(value: UpscaleProvider): UpscaleProvider {
    if (typeof window !== 'undefined') {
        window.localStorage.setItem(UPSCALE_PROVIDER_KEY, value);
    }
    return value;
}

export function clearUpscaleProvider(): void {
    if (typeof window !== 'undefined') {
        window.localStorage.removeItem(UPSCALE_PROVIDER_KEY);
    }
}

// Ideogram Upscale settings 
export interface IdeogramUpscaleSettings {
    resemblance?: number; // 1..100
    detail?: number; // 1..100
    magic_prompt_option?: 'AUTO' | 'ON' | 'OFF';
    seed?: number | null;
}
const IDEO_UPSCALE_KEY = 'merchalyzer.workflow.ideogram.upscale.v1';

export function loadIdeogramUpscaleSettings(): IdeogramUpscaleSettings {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(IDEO_UPSCALE_KEY);
        const parsed = raw ? JSON.parse(raw) as IdeogramUpscaleSettings : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

export function saveIdeogramUpscaleSettings(value: IdeogramUpscaleSettings): IdeogramUpscaleSettings {
    if (typeof window !== 'undefined') {
        window.localStorage.setItem(IDEO_UPSCALE_KEY, JSON.stringify(value || {}));
    }
    return value;
}

export function clearIdeogramUpscaleSettings(): void {
    if (typeof window !== 'undefined') {
        window.localStorage.removeItem(IDEO_UPSCALE_KEY);
    }
}
// Mockup generation provider (Ideogram by default, OpenRouter as fallback)
export type MockupProvider = 'ideogram' | 'openrouter';
const MOCKUP_PROVIDER_KEY = 'merchalyzer.mockup.provider.v1';

export function loadMockupProvider(): MockupProvider {
    if (typeof window === 'undefined') return 'ideogram';
    try {
        const raw = window.localStorage.getItem(MOCKUP_PROVIDER_KEY);
        return raw === 'openrouter' || raw === 'ideogram' ? (raw as MockupProvider) : 'ideogram';
    } catch {
        return 'ideogram';
    }
}

export function saveMockupProvider(value: MockupProvider): MockupProvider {
    if (typeof window !== 'undefined') {
        window.localStorage.setItem(MOCKUP_PROVIDER_KEY, value);
    }
    return value;
}

export function clearMockupProvider(): void {
    if (typeof window !== 'undefined') {
        window.localStorage.removeItem(MOCKUP_PROVIDER_KEY);
    }
}

// Ideogram default settings
export interface IdeogramDefaults {
    aspect_ratio?: import('./ideogram').IdeogramAspectRatio;
    rendering_speed?: import('./ideogram').IdeogramRenderingSpeed;
    magic_prompt?: import('./ideogram').IdeogramMagicPrompt;
    style_type?: import('./ideogram').IdeogramStyleType;
    negative_prompt?: string;
    seed?: number | null;
}

const IDEOGRAM_DEFAULTS_KEY = 'merchalyzer.ideogram.defaults.v1';

export function loadIdeogramDefaults(): IdeogramDefaults {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(IDEOGRAM_DEFAULTS_KEY);
        const parsed = raw ? JSON.parse(raw) as IdeogramDefaults : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

export function saveIdeogramDefaults(value: IdeogramDefaults): IdeogramDefaults {
    if (typeof window !== 'undefined') {
        window.localStorage.setItem(IDEOGRAM_DEFAULTS_KEY, JSON.stringify(value || {}));
    }
    return value;
}

export function clearIdeogramDefaults(): void {
    if (typeof window !== 'undefined') {
        window.localStorage.removeItem(IDEOGRAM_DEFAULTS_KEY);
    }
}

// Saved mockups (per idea id -> selected image data URLs)
export type SavedMockups = Record<string, string[]>;

export function loadSavedMockups(): SavedMockups {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(DESIGN_MOCKUPS_SAVED_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as SavedMockups;
        }
        return {};
    } catch {
        return {};
    }
}

export function saveSavedMockups(value: SavedMockups): SavedMockups {
    if (typeof window !== 'undefined') {
        try {
            window.localStorage.setItem(DESIGN_MOCKUPS_SAVED_KEY, JSON.stringify(value || {}));
        } catch (err) {
            console.warn('Failed to persist saved mockups; size may be too large.', err);
        }
    }
    return value;
}

export function clearSavedMockups(): void {
    if (typeof window !== 'undefined') {
        window.localStorage.removeItem(DESIGN_MOCKUPS_SAVED_KEY);
    }
}

// General-purpose user styles (reusable across features)
export interface UserStyle {
    id: string;
    name: string; // display name
    label?: string; // concise label
    details?: string; // detailed guidance text
    tags?: string[]; // arbitrary tags/contexts, e.g. ['design','image','mockup']
    createdAt?: number;
    updatedAt?: number;
}

export function loadUserStyles(): UserStyle[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(USER_STYLES_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        return Array.isArray(parsed) ? (parsed as UserStyle[]) : [];
    } catch {
        return [];
    }
}

export function saveUserStyles(styles: UserStyle[]): UserStyle[] {
    if (typeof window !== 'undefined') {
        window.localStorage.setItem(USER_STYLES_KEY, JSON.stringify(styles || []));
    }
    return styles;
}

export function upsertUserStyle(style: UserStyle): UserStyle[] {
    const list = loadUserStyles();
    const idx = list.findIndex((s) => s.id === style.id);
    const now = Date.now();
    const next: UserStyle = { ...style, updatedAt: now, createdAt: style.createdAt ?? now };
    if (idx >= 0) list[idx] = next; else list.unshift(next);
    return saveUserStyles(list);
}

export function deleteUserStyle(id: string): UserStyle[] {
    const list = loadUserStyles().filter((s) => s.id !== id);
    return saveUserStyles(list);
}

const WORKFLOW_KEY = 'merchalyzer.workflow.v1';
const WORKFLOW_METADATA_KEY = 'merchalyzer.workflow.metadata.v1';

interface SerializedWorkflowImage {
	id: string;
	fileName: string;
	fileType: string;
	fileSize: number;
	base64Data: string;
	processedUrl?: string;
	thumbnailUrl?: string;
	status: WorkflowImage['status'];
	error?: string;
	metadata: WorkflowImage['metadata'];
    processingSteps: WorkflowImage['processingSteps'];
    history?: string[];
    historySteps?: string[];
}

interface SerializedWorkflowMetadata {
	id: string;
	fileName: string;
	fileType: string;
	fileSize: number;
	status: WorkflowImage['status'];
	error?: string;
	metadata: WorkflowImage['metadata'];
	processingSteps: WorkflowImage['processingSteps'];
	// Note: No base64Data, processedUrl, or thumbnailUrl in metadata-only version
}

export async function loadWorkflowImages(): Promise<WorkflowImage[]> {
	if (typeof window === 'undefined') {
		return [];
	}
	try {
		// First try to load full workflow data
		let raw = window.localStorage.getItem(WORKFLOW_KEY);

		if (!raw) {
			// If no full data, try to load metadata-only version
			raw = window.localStorage.getItem(WORKFLOW_METADATA_KEY);
			if (raw) {
				console.log('📋 Loading workflow from metadata-only backup');
			}
		}

		if (!raw) {
			return [];
		}

		const serialized = JSON.parse(raw);

		// Check if this is full data or metadata-only
		const isMetadataOnly = !serialized[0]?.base64Data;

		if (isMetadataOnly) {
			// Handle metadata-only loading (images need to be re-uploaded)
			const metadataImages: SerializedWorkflowMetadata[] = serialized;

			// Create placeholder WorkflowImage objects with metadata but no actual files
			const images: WorkflowImage[] = metadataImages.map((item) => {
				// Create a placeholder file (this will be replaced when user re-uploads)
				const placeholderFile = new File([''], item.fileName, { type: item.fileType });

				return {
					id: item.id,
					originalFile: placeholderFile,
					processedUrl: undefined, // No processed data in metadata-only
					thumbnailUrl: undefined, // No thumbnail data in metadata-only
					status: item.status,
					error: item.error ? `${item.error} (Images need to be re-uploaded)` : undefined,
					metadata: item.metadata,
					processingSteps: item.processingSteps,
				};
			});

			console.warn('⚠️ Loaded workflow metadata only. Original images need to be re-uploaded.');
			return images;
		} else {
			// Handle full data loading
			const fullImages: SerializedWorkflowImage[] = serialized;

			// Convert serialized data back to WorkflowImage objects
			const images: WorkflowImage[] = await Promise.all(
				fullImages.map(async (item) => {
					// Convert base64 back to File
					const response = await fetch(item.base64Data);
					const blob = await response.blob();
					const file = new File([blob], item.fileName, { type: item.fileType });

            return {
                id: item.id,
                originalFile: file,
                processedUrl: item.processedUrl,
                thumbnailUrl: item.thumbnailUrl,
                status: item.status,
                error: item.error,
                metadata: item.metadata,
                processingSteps: item.processingSteps,
                history: item.history,
                historySteps: item.historySteps,
            };
        })
        );

			return images;
		}
	} catch (error) {
		console.error('Error loading workflow images:', error);
		return [];
	}
}

// Save workflow images with metadata-only fallback
export async function saveWorkflowImages(images: WorkflowImage[]): Promise<void> {
	if (typeof window === 'undefined') {
		return;
	}
	try {
		// Convert WorkflowImage objects to serializable format
		const serialized: SerializedWorkflowImage[] = await Promise.all(
			images.map(async (image) => {
				// Convert File to base64
				const base64Data = await fileToBase64(image.originalFile);

        return {
            id: image.id,
            fileName: image.originalFile.name,
            fileType: image.originalFile.type,
            fileSize: image.originalFile.size,
            base64Data,
            processedUrl: image.processedUrl,
            thumbnailUrl: image.thumbnailUrl,
            status: image.status,
            error: image.error,
            metadata: image.metadata,
            processingSteps: image.processingSteps,
            history: image.history,
            historySteps: image.historySteps,
        };
			})
		);

		const serializedData = JSON.stringify(serialized);

		// Check if data size exceeds reasonable limits before saving
		const dataSizeBytes = new Blob([serializedData]).size;
		const dataSizeMB = dataSizeBytes / (1024 * 1024);

		// Warn if approaching localStorage limits (browsers typically limit to 5-10MB)
		if (dataSizeMB > 2) {
			console.warn(`⚠️ Large workflow data detected: ${dataSizeMB.toFixed(2)}MB. Most browsers limit localStorage to 5-10MB per domain.`);
		}

		// Check current localStorage usage
		const availableSpace = getEstimatedAvailableSpace();

		if (dataSizeBytes > availableSpace) {
			console.warn('🚨 Full workflow data too large, attempting metadata-only fallback...');
			// Try metadata-only storage as fallback
			await saveWorkflowMetadataOnly(images);
			const dataSizeMB = dataSizeBytes / (1024 * 1024);
			const availableMB = availableSpace / (1024 * 1024);
			throw new Error(`Storage quota exceeded. Data size: ${dataSizeMB.toFixed(2)}MB, Available: ${availableMB.toFixed(2)}MB. Most browsers limit localStorage to 5-10MB. Metadata saved, but images will need to be re-uploaded.`);
		}

		window.localStorage.setItem(WORKFLOW_KEY, serializedData);
		// Clear any metadata-only backup when full data saves successfully
		window.localStorage.removeItem(WORKFLOW_METADATA_KEY);
	} catch (error) {
		if (error instanceof Error && error.name === 'QuotaExceededError') {
			console.error('🚨 localStorage quota exceeded. Workflow data too large to save.');
			// Try metadata-only fallback
			try {
				await saveWorkflowMetadataOnly(images);
				throw new Error('Browser storage quota exceeded. Most browsers limit localStorage to 5-10MB per domain. Metadata saved, but images will need to be re-uploaded.');
			} catch {
				throw new Error('Browser storage quota exceeded. Unable to save workflow data. Try reducing the number of images or clearing storage.');
			}
		} else if (error instanceof Error && error.message.includes('Storage quota exceeded')) {
			console.error('🚨 Estimated storage quota exceeded:', error.message);
			throw error;
		} else {
			console.error('Error saving workflow images:', error);
			throw error;
		}
	}
}

// Save metadata-only version (fallback when full data is too large)
async function saveWorkflowMetadataOnly(images: WorkflowImage[]): Promise<void> {
	if (typeof window === 'undefined') {
		return;
	}

	try {
		// Convert to metadata-only format (no image data)
		const serialized: SerializedWorkflowMetadata[] = images.map((image) => ({
			id: image.id,
			fileName: image.originalFile.name,
			fileType: image.originalFile.type,
			fileSize: image.originalFile.size,
			status: image.status,
			error: image.error,
			metadata: image.metadata,
			processingSteps: image.processingSteps,
		}));

		const serializedData = JSON.stringify(serialized);
		const dataSizeBytes = new Blob([serializedData]).size;

		// Check if even metadata is too large
		const availableSpace = getEstimatedAvailableSpace();
		if (dataSizeBytes > availableSpace) {
			throw new Error('Even metadata is too large to store');
		}

		window.localStorage.setItem(WORKFLOW_METADATA_KEY, serializedData);
		console.log('✅ Workflow metadata saved as fallback');
	} catch (error) {
		console.error('Error saving workflow metadata:', error);
		throw error;
	}
}

export function clearWorkflowImages(): void {
	if (typeof window !== 'undefined') {
		window.localStorage.removeItem(WORKFLOW_KEY);
		window.localStorage.removeItem(WORKFLOW_METADATA_KEY);
	}
}

// IndexedDB-based workflow storage functions (high capacity)
// New format (per-image records with Blob) to avoid giant JSON strings.
// Backward compatible: loader also understands the old single-record format.

type IDBWorkflowItem = {
    id: string;
    timestamp: number;
    fileName: string;
    fileType: string;
    fileSize: number;
    blob: Blob; // original image data
    processedUrl?: string;
    thumbnailUrl?: string;
    status: WorkflowImage['status'];
    error?: string;
    metadata: WorkflowImage['metadata'];
    processingSteps: WorkflowImage['processingSteps'];
    history?: string[];
    historySteps?: string[];
};

export async function saveWorkflowImagesIndexedDB(images: WorkflowImage[]): Promise<void> {
    try {
        const db = await initIndexedDB();

        const tx = db.transaction([WORKFLOW_STORE], 'readwrite');
        const store = tx.objectStore(WORKFLOW_STORE);

        // Clear existing entries (both new and legacy) before saving
        await new Promise<void>((resolve, reject) => {
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(new Error('Failed to clear workflow store'));
        });

        const puts = images.map((image) => {
            const rec: IDBWorkflowItem = {
                id: image.id,
                timestamp: Date.now(),
                fileName: image.originalFile.name,
                fileType: image.originalFile.type,
                fileSize: image.originalFile.size,
                blob: image.originalFile, // File is a Blob; store directly
                processedUrl: image.processedUrl,
                thumbnailUrl: image.thumbnailUrl,
                status: image.status,
                error: image.error,
                metadata: image.metadata,
                processingSteps: image.processingSteps,
                history: image.history,
                historySteps: image.historySteps,
            };

            return new Promise<void>((resolve, reject) => {
                const r = store.put(rec);
                r.onsuccess = () => resolve();
                r.onerror = () => reject(new Error('Failed to write workflow item'));
            });
        });

        await Promise.all(puts);

        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('Transaction error while saving workflow'));
            tx.onabort = () => reject(tx.error || new Error('Transaction aborted while saving workflow'));
        });

        console.log(`✅ Workflow saved to IndexedDB: ${images.length} images (per-item records)`);
    } catch (error) {
        console.error('Error saving workflow to IndexedDB:', error);
        throw error;
    }
}

export async function loadWorkflowImagesIndexedDB(): Promise<WorkflowImage[]> {
    try {
        const db = await initIndexedDB();

        const transaction = db.transaction([WORKFLOW_STORE], 'readonly');
        const store = transaction.objectStore(WORKFLOW_STORE);

        // First, try legacy single-record format
        const legacy = await new Promise<unknown>((resolve) => {
            const req = store.get('current_workflow');
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });

        if (legacy && typeof legacy === 'object' && 'data' in legacy) {
            try {
                const decompressedData = await decompressData((legacy as { data: string }).data);
                const serialized = JSON.parse(decompressedData);
                const images: WorkflowImage[] = await Promise.all(
                    serialized.map(async (item: SerializedWorkflowImage) => {
                        const response = await fetch(item.base64Data);
                        const blob = await response.blob();
                        const file = new File([blob], item.fileName, { type: item.fileType });
                        return {
                            id: item.id,
                            originalFile: file,
                            processedUrl: item.processedUrl,
                            thumbnailUrl: item.thumbnailUrl,
                            status: item.status,
                            error: item.error,
                            metadata: item.metadata,
                            processingSteps: item.processingSteps,
                        };
                    })
                );
                console.log(`📂 Workflow loaded from IndexedDB (legacy format): ${images.length} images`);
                return images;
            } catch (e) {
                console.warn('Failed to parse legacy workflow format, falling back to per-item records:', e);
            }
        }

        // New format: get all per-item records
        const items: IDBWorkflowItem[] = await new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result as IDBWorkflowItem[]);
            req.onerror = () => reject(new Error('Failed to read workflow items'));
        });

        if (!items || items.length === 0) return [];

        const images: WorkflowImage[] = items.map((it) => {
            const file = new File([it.blob], it.fileName, { type: it.fileType });
            return {
                id: it.id,
                originalFile: file,
                processedUrl: it.processedUrl,
                thumbnailUrl: it.thumbnailUrl,
                status: it.status,
                error: it.error,
                metadata: it.metadata,
                processingSteps: it.processingSteps,
                history: it.history,
                historySteps: it.historySteps,
            };
        });

        console.log(`📂 Workflow loaded from IndexedDB (per-item records): ${images.length} images`);
        return images;

    } catch (error) {
        console.error('Error loading workflow from IndexedDB:', error);
        return [];
    }
}

export async function clearWorkflowImagesIndexedDB(): Promise<void> {
    try {
        const db = await initIndexedDB();
        const transaction = db.transaction([WORKFLOW_STORE], 'readwrite');
        const store = transaction.objectStore(WORKFLOW_STORE);

        await new Promise<void>((resolve, reject) => {
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(new Error('Failed to clear workflow store'));
        });

        // Also try to remove legacy record if present (ignore errors)
        try {
            await new Promise<void>((resolve) => {
                const r = store.delete('current_workflow');
                r.onsuccess = () => resolve();
                r.onerror = () => resolve();
            });
        } catch {}

        console.log('🗑️ Workflow cleared from IndexedDB');
    } catch (error) {
        console.error('Error clearing workflow from IndexedDB:', error);
        throw error;
    }
}

export async function getIndexedDBStorageInfo(): Promise<{ usage: number; available: number; quota: number }> {
	try {
		if ('storage' in navigator && 'estimate' in navigator.storage) {
			const estimate = await navigator.storage.estimate();
			const usage = estimate.usage || 0;
			const quota = estimate.quota || 0;
			const available = quota - usage;

			return {
				usage: usage / (1024 * 1024), // Convert to MB
				available: available / (1024 * 1024), // Convert to MB
				quota: quota / (1024 * 1024), // Convert to MB
			};
		}

		// Fallback for browsers that don't support storage estimation
		return {
			usage: 0,
			available: 1024, // Assume 1GB available as fallback
			quota: 1024,
		};

	} catch (error) {
		console.warn('Could not get storage info:', error);
		return {
			usage: 0,
			available: 1024,
			quota: 1024,
		};
	}
}

// Helper function to convert File to base64
function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

// Helper function to get current localStorage usage
function getLocalStorageUsage(): number {
	if (typeof window === 'undefined') return 0;

	let total = 0;
	for (const key in window.localStorage) {
		if (window.localStorage.hasOwnProperty(key)) {
			total += (window.localStorage[key].length + key.length) * 2; // *2 for UTF-16
		}
	}
	return total;
}

// Helper function to estimate available localStorage space
function getEstimatedAvailableSpace(): number {
	if (typeof window === 'undefined') return 0;

	// Most browsers limit localStorage to 5-10MB per domain
	// We'll use a conservative estimate of 8MB as the maximum
	const maxQuotaBytes = 8 * 1024 * 1024; // 8MB (conservative estimate)
	const currentUsage = getLocalStorageUsage();

	// Leave some buffer for other localStorage operations
	const bufferBytes = 1 * 1024 * 1024; // 1MB buffer

	const available = Math.max(0, maxQuotaBytes - currentUsage - bufferBytes);
	return available;
}

// Helper function to check if localStorage quota is approaching limits
export function checkStorageQuota(): { usage: number; available: number; warning: boolean } {
	const usage = getLocalStorageUsage();
	const available = getEstimatedAvailableSpace();
	const usageMB = usage / (1024 * 1024);
	const availableMB = available / (1024 * 1024);

	return {
		usage: usageMB,
		available: availableMB,
		warning: availableMB < 1 // Warn when less than 1MB available
	};
}

// Function to detect actual browser localStorage quota
export function detectBrowserQuota(): { detectedQuota: number; error: string | null } {
	if (typeof window === 'undefined') {
		return { detectedQuota: 0, error: 'Not in browser environment' };
	}

	try {
		// Try to find the actual quota by progressively filling localStorage
		const testKey = '__quota_test__';
		let testData = 'x'.repeat(1024 * 1024); // 1MB chunks
		let totalSize = 0;

		// Clear any existing test data
		window.localStorage.removeItem(testKey);

		// Try to fill localStorage to find the limit
		while (true) {
			try {
				window.localStorage.setItem(testKey, testData);
				totalSize += testData.length;
				testData = testData + 'x'.repeat(1024 * 1024); // Add another MB

				// Safety check to avoid infinite loop
				if (totalSize > 50 * 1024 * 1024) { // 50MB safety limit
					break;
				}
			} catch {
				// We've hit the quota limit
				window.localStorage.removeItem(testKey);
				return {
					detectedQuota: Math.floor(totalSize / (1024 * 1024)), // Convert to MB
					error: null
				};
			}
		}

		// If we got here, we didn't hit the limit
		window.localStorage.removeItem(testKey);
		return {
			detectedQuota: Math.floor(totalSize / (1024 * 1024)),
			error: null
		};
	} catch (error) {
		return {
			detectedQuota: 0,
			error: error instanceof Error ? error.message : 'Unknown error detecting quota'
		};
	}
}

// Function to clear all localStorage data
export function clearAllStorage(): void {
	if (typeof window !== 'undefined') {
		try {
			// Clear all localStorage items
			window.localStorage.clear();
			console.log('🗑️ All localStorage data cleared');
		} catch (error) {
			console.error('Error clearing localStorage:', error);
		}
	}
}

// Function to clear all processed images from the processed folder
export async function clearProcessedFolder(): Promise<void> {
	try {
		const response = await fetch('/api/workflow/clear-processed', {
			method: 'POST',
		});

		if (!response.ok) {
			throw new Error(`Failed to clear processed folder: ${response.statusText}`);
		}

		const result = await response.json();
		console.log('🗑️ Processed folder cleared:', result.message);
	} catch (error) {
		console.error('Error clearing processed folder:', error);
		throw error;
	}
}
