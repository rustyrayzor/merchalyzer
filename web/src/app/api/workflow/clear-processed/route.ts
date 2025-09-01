import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

export async function POST() {
	try {
		// Construct the processed directory path
		const processedDir = path.join(process.cwd(), 'processed');

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

		// Read all files in the processed directory
		let files;
		try {
			files = await fs.readdir(processedDir);
		} catch (error) {
			console.error('Error reading processed directory:', error);
			return NextResponse.json(
				{ error: 'Failed to read processed directory' },
				{ status: 500 }
			);
		}

		// Delete each file in the processed directory
		let deletedCount = 0;
		for (const file of files) {
			try {
				const filePath = path.join(processedDir, file);
				const stat = await fs.stat(filePath);

				// Only delete files, not directories
				if (stat.isFile()) {
					await fs.unlink(filePath);
					deletedCount++;
				}
			} catch (error) {
				console.error(`Error deleting file ${file}:`, error);
				// Continue with other files even if one fails
			}
		}

		console.log(`🗑️ Cleared ${deletedCount} files from processed folder`);

		return NextResponse.json({
			success: true,
			message: `Successfully cleared ${deletedCount} files from processed folder`
		});

	} catch (error) {
		console.error('Error clearing processed folder:', error);
		return NextResponse.json(
			{ error: 'Failed to clear processed folder' },
			{ status: 500 }
		);
	}
}
