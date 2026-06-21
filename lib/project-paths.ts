import { isAbsolute, join } from 'path';

/** Resolve UPLOAD_DIR — absolute env values are used as-is; relative values are under cwd. */
export function resolveUploadDir(cwd = process.cwd()): string {
  const configured = process.env.UPLOAD_DIR || './uploads';
  return isAbsolute(configured) ? configured : join(cwd, configured);
}

function resolveTempDir(cwd = process.cwd()): string {
  const configured = process.env.TEMP_DIR || './temp';
  return isAbsolute(configured) ? configured : join(cwd, configured);
}
