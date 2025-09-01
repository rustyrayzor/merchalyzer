import { RowData } from './types';
import JSZip from 'jszip';

function escapeCsvValue(value: string): string {
	const needsQuotes = value.includes(',') || value.includes('\n') || value.includes('"');
	const escaped = value.replace(/"/g, '""');
	return needsQuotes ? `"${escaped}"` : escaped;
}

export function rowsToCsv(rows: RowData[]): string {
	const headers = ['Image Name', 'Brand', 'Title', 'Bullet 1', 'Bullet 2', 'Description'];
	const headerLine = headers.map(escapeCsvValue).join(',');
	const lines = rows.map((r) => {
		const cols = [r.imageName, r.brand, r.title, r.bullet1, r.bullet2, r.description];
		return cols.map(escapeCsvValue).join(',');
	});
	const csv = [headerLine, ...lines].join('\n');
	// Prepend UTF-8 BOM for Excel compatibility
	return `\uFEFF${csv}`;
}

export function triggerDownloadCsv(csv: string, filename: string): void {
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

export interface ImageData {
	title: string;
	processedUrl?: string;
	thumbnailUrl?: string; // Kept for UI purposes, not used in ZIP logic
	originalFile: File;
	processingSteps?: {
		generated?: boolean;
		scaled?: boolean;
		backgroundRemoved?: boolean;
		upscaled?: boolean;
		aiEdited?: boolean;
	};
}

export async function createZipWithCsvAndImages(
	rows: RowData[],
	images: ImageData[],
	baseFilename: string
): Promise<void> {
	const zip = new JSZip();

	// Add CSV file
	const csv = rowsToCsv(rows);
	zip.file(`${baseFilename}.csv`, csv);

	// Add images folder
	const imagesFolder = zip.folder('images');

	if (imagesFolder) {
		// Process each image
		for (let i = 0; i < images.length; i++) {
			const image = images[i];
			const batchNumber = (i + 1).toString().padStart(3, '0'); // 001, 002, etc.

			// Use title for filename, fallback to generic name if empty
			let title = image.title?.trim() || `Untitled-${batchNumber}`;

			// Sanitize title for filename (remove invalid characters)
			title = title.replace(/[^a-zA-Z0-9\s\-_]/g, '').replace(/\s+/g, '-');

			// Limit length to avoid overly long filenames
			if (title.length > 50) {
				title = title.substring(0, 50);
			}

			const filename = `${title}-${batchNumber}.png`;

			try {
				// Check if any processing was done on this image
				const hasProcessingSteps = image.processingSteps && Object.values(image.processingSteps).some(step => step === true);

				if (hasProcessingSteps && image.processedUrl) {
					// Processing was done and processed URL is available - use processed image
					const response = await fetch(image.processedUrl);
					if (response.ok) {
						const blob = await response.blob();
						const arrayBuffer = await blob.arrayBuffer();
						imagesFolder.file(filename, arrayBuffer);
					} else {
						console.warn(`Failed to fetch processed image for ${filename}, using original`);
						// Fallback to original file
						const arrayBuffer = await image.originalFile.arrayBuffer();
						imagesFolder.file(filename, arrayBuffer);
					}
				} else {
					// No processing was done OR processing was done but no processed URL available - use original image
					const arrayBuffer = await image.originalFile.arrayBuffer();
					imagesFolder.file(filename, arrayBuffer);
				}
			} catch (error) {
				console.error(`Error adding image ${filename} to ZIP:`, error);
			}
		}
	}

	// Generate and download the ZIP file
	try {
		const zipBlob = await zip.generateAsync({ type: 'blob' });
		const url = URL.createObjectURL(zipBlob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${baseFilename}.zip`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	} catch (error) {
		console.error('Error generating ZIP file:', error);
		throw new Error('Failed to create ZIP file');
	}
}


