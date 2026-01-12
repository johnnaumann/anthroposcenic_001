# Exports Directory

This directory contains exported data from ComfyUI processing jobs, saved for git tracking and version control.

## Structure

Each export is saved in a timestamped folder:

```
{imageId}-{timestamp}/
├── description.txt      # The AI-generated description text
├── image.base64.txt     # Base64-encoded image data
└── metadata.json        # JSON metadata with imageId, timestamp, mimeType, etc.
```

## Purpose

- **Version Control**: Track descriptions and image data used in ComfyUI workflows
- **Reproducibility**: Recreate workflows with exact inputs
- **Documentation**: Maintain a history of processed images and their descriptions
- **Git-Friendly**: Text-based format (base64, txt, json) is better for git than binary files

## Example

```
05a0ad6b-996a-4e67-a006-11f1c39ddf5c-2026-01-12T11-30-45-123Z/
├── description.txt
├── image.base64.txt
└── metadata.json
```

## Note

This directory is tracked in git. Large base64 files may increase repository size, but they're text-based and compress well.
