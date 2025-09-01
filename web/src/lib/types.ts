export type FieldName = 'brand' | 'title' | 'keywords' | 'bullet1' | 'bullet2' | 'description';

export interface GeneratedFields {
	brand: string;
	title: string;
	keywords?: string;
	bullet1: string;
	bullet2: string;
	description: string;
}

export interface RowData extends GeneratedFields {
	imageName: string;
}

export type FieldStatus = 'idle' | 'loading' | 'error' | 'done';

export interface RowStatus {
	brand: FieldStatus;
	title: FieldStatus;
	keywords?: FieldStatus;
	bullet1: FieldStatus;
	bullet2: FieldStatus;
	description: FieldStatus;
}

export interface GenerateRowRequest {
	imageName: string;
	instructions: string;
	brand?: string;
	keywords?: string;
	model: string;
	/** Data URL string, e.g. "data:image/jpeg;base64,...." */
	imageBase64?: string;
}

export interface GenerateFieldRequest extends GenerateRowRequest {
	field: FieldName;
}

export interface GenerateRowResponse {
	fields: GeneratedFields;
}

export interface GenerateFieldResponse {
	field: FieldName;
	value: string;
}

export interface TemplateItem {
	id: string;
	name: string;
	value: string;
}

export interface ModelPreset {
	id: string;
	label: string;
	model: string;
	vision?: boolean;
}


export interface ImageEditInstruction {
	id: string;
	text: string;
	createdAt: number;
}

export interface ImageEditOutput {
	id: string;
	base64DataUrl: string;
	fromInstructionId: string;
	createdAt: number;
}

export interface ImageEditItem {
	imageName: string;
	originalBase64: string;
	instructions: ImageEditInstruction[];
	outputs: ImageEditOutput[];
}

export interface EditImageRequest {
	model: string;
	imageName: string;
	originalBase64: string;
	instruction: string;
}

export interface EditImageResponse {
	base64DataUrl: string;
}

// Workflow Image Processing Types
export type WorkflowImageStatus = 'pending' | 'processing' | 'done' | 'error';

export interface WorkflowImage {
	id: string;
	originalFile: File;
	processedUrl?: string;
	thumbnailUrl?: string;
	status: WorkflowImageStatus;
	error?: string;
	metadata: {
		brand: string;
		title?: string; // Made optional so users can manually specify design text
		keywords?: string;
		bullet1?: string;
		bullet2?: string;
		description?: string;
	};
	processingSteps: {
		generated?: boolean;
		scaled?: boolean;
		backgroundRemoved?: boolean;
		upscaled?: boolean;
		aiEdited?: boolean;
		colorChanged?: boolean;
		inverted?: boolean;
	};
}

// Printify Integration Types
export interface PrintifyStore {
	id: string;
	title: string;
	description?: string;
	sales_channel: string;
	created_at: string;
	updated_at: string;
}

export interface PrintifyStoresResponse {
	data: PrintifyStore[];
	meta: {
		limit: number;
		offset: number;
		total: number;
	};
}

export interface PrintifyProduct {
	id: string;
	title: string;
	description?: string;
	images: PrintifyProductImage[];
	variants: PrintifyProductVariant[];
	created_at: string;
	updated_at: string;
	visible: boolean;
	is_locked: boolean;
	blueprint_id: string;
	user_id: string;
	shop_id: string;
	print_provider_id: string;
	print_areas: PrintifyPrintArea[];
	tags: string[];
}

export interface PrintifyProductImage {
	src: string;
	variant_ids: string[];
	position: string;
	is_default: boolean;
}

export interface PrintifyProductVariant {
	id: string;
	sku: string;
	cost: number;
	price: number;
	title: string;
	grams: number;
	is_enabled: boolean;
	is_default: boolean;
	is_available: boolean;
	is_printful_store: boolean;
	inventory_quantity: number;
	external_id: string;
	product_id: string;
	size: string;
	color: string;
	color_code: string;
	color_code2: string;
	image: string;
	in_stock: boolean;
}

export interface PrintifyPrintArea {
	variant_ids: string[];
	placeholders: PrintifyPlaceholder[];
	background: string;
}

export interface PrintifyPlaceholder {
	position: string;
	images: PrintifyPlaceholderImage[];
}

export interface PrintifyPlaceholderImage {
	id: string;
	name: string;
	type: string;
	height: number;
	width: number;
	x: number;
	y: number;
	scale: number;
	angle: number;
}

export interface PrintifyProductsResponse {
	data: PrintifyProduct[];
	meta: {
		limit: number;
		offset: number;
		total: number;
	};
}
