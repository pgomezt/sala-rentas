import { createHash } from "node:crypto";
import { createReadStream, constants } from "node:fs";
import { copyFile, mkdir, readdir, realpath, stat } from "node:fs/promises";
import { basename, extname, isAbsolute, relative, resolve, sep } from "node:path";

export interface SourceFile { path: string; name: string; size: number; modifiedMs: number; sha256: string }
export function within(parent: string, child: string): boolean {
  const path = relative(resolve(parent), resolve(child));
  return path === "" || (!path.startsWith(".." + sep) && path !== ".." && !isAbsolute(path));
}
export function acceptedFile(name: string): boolean {
  return !name.startsWith("~$") && !name.startsWith(".") && [".xls", ".xlsx"].includes(extname(name).toLowerCase());
}
export async function sha256(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
export async function inspectFile(path: string): Promise<SourceFile> {
  const before = await stat(path);
  if (!before.isFile() || before.size > 256 * 1024 * 1024) throw new Error("FILE_SIZE_OR_TYPE");
  const hash = await sha256(path);
  const after = await stat(path);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ino !== after.ino) {
    throw new Error("FILE_CHANGED_DURING_READ");
  }
  return { path, name: basename(path), size: after.size, modifiedMs: after.mtimeMs, sha256: hash };
}
export async function listFiles(directory: string): Promise<SourceFile[]> {
  const base = await realpath(directory);
  const entries = (await readdir(base, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name));
  const files: SourceFile[] = [];
  for (const entry of entries) {
    if (!acceptedFile(entry.name) || !entry.isFile()) continue;
    const path = await realpath(resolve(base, entry.name));
    if (!within(base, path)) throw new Error("SOURCE_OUTSIDE_DIRECTORY");
    files.push(await inspectFile(path));
  }
  return files;
}
export async function preserveOriginal(file: SourceFile, directory: string, projectRoot: string): Promise<string> {
  // Archives must stay inside the project; never overwrite a source or existing archive.
  if (!within(projectRoot, directory) || resolve(directory) === resolve(projectRoot)) throw new Error("UNSAFE_ARCHIVE_DIRECTORY");
  await mkdir(directory, { recursive: true });
  const actualDirectory = await realpath(directory);
  if (!within(await realpath(projectRoot), actualDirectory)) throw new Error("UNSAFE_ARCHIVE_DIRECTORY");
  const destination = resolve(actualDirectory, file.sha256 + extname(file.name).toLowerCase());
  try { await copyFile(file.path, destination, constants.COPYFILE_EXCL); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  if(!within(actualDirectory,await realpath(destination)))throw new Error("ARCHIVE_OUTSIDE_DIRECTORY");
  if (await sha256(destination) !== file.sha256) throw new Error("ARCHIVE_HASH_MISMATCH");
  const after = await stat(file.path);
  if (after.size !== file.size || after.mtimeMs !== file.modifiedMs) throw new Error("SOURCE_CHANGED_DURING_COPY");
  return destination;
}
