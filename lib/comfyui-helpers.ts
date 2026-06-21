/**
 * Shared helpers for ComfyUI API and model-directory lookups.
 */

export interface ComfyHistoryOutputImage {
  filename: string;
  subfolder?: string;
  type?: string;
}

export type ComfyHistoryOutputs = Record<string, { images?: ComfyHistoryOutputImage[] }>;

export async function fetchComfyObjectInfo(host: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${host}/object_info`, { method: 'GET' });

  if (!response.ok) {
    throw new Error(`ComfyUI API error: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

/** Parse ComfyUI object_info list fields formatted as [[names], metadata] or string[]. */
export function parseObjectInfoStringList(field: unknown): string[] | null {
  if (!Array.isArray(field) || field.length === 0) {
    return null;
  }

  if (Array.isArray(field[0]) && field[0].length > 0) {
    return field[0] as string[];
  }

  if (typeof field[0] === 'string') {
    return field as string[];
  }

  return null;
}

export async function findComfyModelsDirFile(
  modelsSubdir: string,
  extensions: string[],
  options: {
    preferPattern?: RegExp;
    nameFilter?: (name: string) => boolean;
    minBytes?: number;
  } = {}
): Promise<string | null> {
  if (typeof process === 'undefined' || !process.versions?.node) {
    return null;
  }

  const minBytes = options.minBytes ?? 1024 * 1024;

  try {
    const { readdir, stat } = await import('fs/promises');
    const { join } = await import('path');
    const dir = join(process.cwd(), 'comfyui', 'models', modelsSubdir);
    const files = await readdir(dir);
    let models = files.filter((file) => extensions.some((ext) => file.endsWith(ext)));

    if (options.nameFilter) {
      models = models.filter(options.nameFilter);
    }

    const preferred = options.preferPattern
      ? models.find((name) => options.preferPattern!.test(name))
      : undefined;
    const pick = preferred || models[0];

    if (!pick) {
      return null;
    }

    try {
      const { size } = await stat(join(dir, pick));
      if (size < minBytes) {
        return null;
      }
    } catch {
      /* ignore stat failure, assume usable */
    }

    return pick;
  } catch {
    return null;
  }
}

export function findFirstHistoryOutputImage(
  outputs: ComfyHistoryOutputs
): ComfyHistoryOutputImage | null {
  for (const nodeOutputs of Object.values(outputs)) {
    if (nodeOutputs.images && nodeOutputs.images.length > 0) {
      return nodeOutputs.images[0];
    }
  }

  return null;
}

export function buildOutputImagePath(image: ComfyHistoryOutputImage): string {
  const subfolder = image.subfolder || '';
  return subfolder ? `${subfolder}/${image.filename}` : image.filename;
}
