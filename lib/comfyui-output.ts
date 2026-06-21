import { COMFYUI_HOST } from '@/lib/comfyui-helpers';

/**
 * Get all ComfyUI history
 */
export async function getAllComfyUIHistory(): Promise<{ [key: string]: unknown } | null> {
  try {
    const response = await fetch(`${COMFYUI_HOST}/history`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error(`Network error connecting to ComfyUI at ${COMFYUI_HOST}:`, error);
    } else {
      console.error('Failed to get all ComfyUI history:', error);
    }
    return null;
  }
}

/**
 * Get output image from ComfyUI
 * Uses Next.js proxy route for better reliability and CORS handling
 */
export function getComfyUIOutputImage(filename: string): string {
  // Use Next.js proxy route instead of direct ComfyUI URL for better reliability
  // This ensures images are accessible even if ComfyUI has CORS restrictions
  return `/api/comfyui/output?filename=${encodeURIComponent(filename)}`;
}

/**
 * Find the most recent output image in the ComfyUI output directory
 * This is a fallback when history API doesn't return the image
 */
export async function findLatestOutputImage(
  promptId: string,
  filenamePrefix: string = 'anthroposcenic',
  jobStartTime?: number
): Promise<{ filename: string; imageUrl: string } | null> {
  try {
    const { readdir, stat } = await import('fs/promises');
    const { join } = await import('path');
    
    const outputDir = join(process.cwd(), 'comfyui', 'output');
    
    // Check if output directory exists
    try {
      await stat(outputDir);
    } catch {
      console.warn(`[FileSystem] Output directory not found: ${outputDir}`);
      return null;
    }
    
    // Read all files in output directory
    const files = await readdir(outputDir);
    
    // Filter for files matching the prefix (e.g., anthroposcenic_*.png)
    const matchingFiles = files.filter(f => 
      f.startsWith(filenamePrefix) && 
      (f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.webp'))
    );
    
    if (matchingFiles.length === 0) {
      console.log(`[FileSystem] No files found with prefix "${filenamePrefix}" in output directory`);
      console.log(`[FileSystem]   Output directory: ${outputDir}`);
      console.log(`[FileSystem]   Total files in directory: ${files.length}`);
      if (files.length > 0) {
        console.log(`[FileSystem]   Sample files: ${files.slice(0, 5).join(', ')}`);
      }
      return null;
    }
    
    console.log(`[FileSystem] Found ${matchingFiles.length} file(s) matching prefix "${filenamePrefix}"`);
    
    // Get file stats and sort by modification time (newest first)
    // Use birthtime (creation time) if available, otherwise use mtime (modification time)
    const filesWithStats = await Promise.all(
      matchingFiles.map(async (filename) => {
        const filePath = join(outputDir, filename);
        const stats = await stat(filePath);
        // Prefer birthtime (creation time) if available, fallback to mtime
        const time = stats.birthtime && stats.birthtime.getTime() > 0 
          ? stats.birthtime.getTime() 
          : stats.mtime.getTime();
        return { 
          filename, 
          mtime: stats.mtime.getTime(), 
          birthtime: stats.birthtime?.getTime() || stats.mtime.getTime(),
          time, // Use this for sorting
          path: filePath 
        };
      })
    );
    
    // Sort by time (newest first) - use birthtime if available, otherwise mtime
    filesWithStats.sort((a, b) => b.time - a.time);
    
    // Log all files for debugging
    console.log(`[FileSystem] All matching files sorted by time (newest first):`);
    filesWithStats.slice(0, 5).forEach((f, i) => {
      console.log(`[FileSystem]   ${i + 1}. ${f.filename} - Time: ${new Date(f.time).toISOString()}, MTime: ${new Date(f.mtime).toISOString()}`);
    });
    
    // If jobStartTime is provided, filter to files created after job started
    // But be lenient - allow files created up to 10 seconds before job start (in case of clock skew or file system delays)
    let candidateFiles = filesWithStats;
    if (jobStartTime) {
      const adjustedStartTime = jobStartTime - 10000; // Allow 10 second window for clock skew and file system delays
      candidateFiles = filesWithStats.filter(f => f.time >= adjustedStartTime);
      
      console.log(`[FileSystem] Job started at: ${new Date(jobStartTime).toISOString()}`);
      console.log(`[FileSystem] Adjusted start time (with 10s window): ${new Date(adjustedStartTime).toISOString()}`);
      console.log(`[FileSystem] Files after adjusted start time: ${candidateFiles.length}`);
      
      if (candidateFiles.length === 0) {
        // No file was created at/after this job started. Do NOT fall back to an older
        // pre-existing image — that returns a STALE result and makes the poller report
        // completion before this job's SaveImage runs (e.g. when an early sampler hits
        // 100% in a multi-pass workflow). Signal "not ready yet" and keep polling.
        console.log(`[FileSystem] No output created after job start yet; not using a stale file`);
        return null;
      } else {
        console.log(`[FileSystem] Found ${candidateFiles.length} file(s) created after job start:`);
        candidateFiles.slice(0, 3).forEach((f, i) => {
          const age = f.time - jobStartTime;
          console.log(`[FileSystem]   ${i + 1}. ${f.filename} - Age: ${age}ms (${(age / 1000).toFixed(1)}s after job start)`);
        });
      }
    }
    
    if (candidateFiles.length > 0) {
      const latestFile = candidateFiles[0];
      const imageUrl = getComfyUIOutputImage(latestFile.filename);
      const fileAge = jobStartTime ? latestFile.time - jobStartTime : 0;
      console.log(`[FileSystem] ✅ Selected latest output image: ${latestFile.filename}`);
      console.log(`[FileSystem]   File time: ${new Date(latestFile.time).toISOString()}`);
      console.log(`[FileSystem]   File mtime: ${new Date(latestFile.mtime).toISOString()}`);
      console.log(`[FileSystem]   Job started: ${jobStartTime ? new Date(jobStartTime).toISOString() : 'unknown'}`);
      console.log(`[FileSystem]   File age relative to job: ${fileAge}ms (${(fileAge / 1000).toFixed(1)}s)`);
      console.log(`[FileSystem]   Image URL: ${imageUrl}`);
      
      // Verify this is actually the newest file
      if (filesWithStats.length > 1 && filesWithStats[0].filename !== latestFile.filename) {
        console.warn(`[FileSystem] ⚠️ WARNING: Selected file is not the absolute newest!`);
        console.warn(`[FileSystem]   Newest file: ${filesWithStats[0].filename} (${new Date(filesWithStats[0].time).toISOString()})`);
        console.warn(`[FileSystem]   Selected file: ${latestFile.filename} (${new Date(latestFile.time).toISOString()})`);
        // Use the absolute newest file instead
        const actualNewest = filesWithStats[0];
        const actualNewestUrl = getComfyUIOutputImage(actualNewest.filename);
        console.log(`[FileSystem] ✅ Using absolute newest file instead: ${actualNewest.filename}`);
        return { filename: actualNewest.filename, imageUrl: actualNewestUrl };
      }
      
      return { filename: latestFile.filename, imageUrl };
    }
    
    console.log(`[FileSystem] ❌ No candidate files found (total matching files: ${filesWithStats.length})`);
    return null;
  } catch (error) {
    console.error('[FileSystem] Error finding output image:', error);
    return null;
  }
}
