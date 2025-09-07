import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

export async function POST() {
	try {
    	// Construct the processed directory path (workflow subfolder)
		const processedDir = path.join(process.cwd(), 'processed', 'workflow');

		// Check if the processed directory exists
		try {
			await fs.access(processedDir);
		} catch {
			// Directory doesn't exist, nothing to clear
			return NextResponse.json({
				success: true,
				message: 'Processed folder does not exist or is already empty'
			});
		}

		// Recursively remove processed/workflow and recreate
		try {
			await fs.rm(processedDir, { recursive: true, force: true });
			await fs.mkdir(processedDir, { recursive: true });
			console.log('🗑️ Cleared processed/workflow folder recursively');
			return NextResponse.json({ success: true, message: 'Processed/workflow cleared' });
		} catch (error) {
			console.error('Error clearing processed folder recursively:', error);
			return NextResponse.json({ error: 'Failed to clear processed folder' }, { status: 500 });
		}

	} catch (error) {
		console.error('Error clearing processed folder:', error);
		return NextResponse.json(
			{ error: 'Failed to clear processed folder' },
			{ status: 500 }
		);
	}
}
