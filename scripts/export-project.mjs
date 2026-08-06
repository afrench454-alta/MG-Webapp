import { createHash } from "node:crypto";
import { readdir, readFile, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
const archiveRoot = packageJson.name || "fieldcentral-pro-console";
const outputDirectory = path.join(projectRoot, "exports");

const excludedDirectories = new Set([
  ".git",
  ".next",
  "build",
  "coverage",
  "exports",
  "node_modules",
  "out",
  "tmp",
]);

function shouldExcludeFile(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  const basename = path.posix.basename(normalized);

  if (basename.startsWith(".env") && basename !== ".env.example") return true;
  if (basename === "next-env.d.ts" || basename.endsWith(".tsbuildinfo")) return true;
  if (basename.endsWith(".log")) return true;
  if (/^qa-.*\.(png|jpe?g|webp)$/i.test(basename)) return true;
  return false;
}

async function collectFiles(directory, relativeDirectory = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;

    const relativePath = path.posix.join(relativeDirectory.replaceAll("\\", "/"), entry.name);
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath, relativePath));
      continue;
    }

    if (!entry.isFile() || shouldExcludeFile(relativePath)) continue;
    files.push({ absolutePath, relativePath });
  }

  return files;
}

function createCrc32Table() {
  return Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
    }
    return value >>> 0;
  });
}

const crc32Table = createCrc32Table();

function crc32(buffer) {
  let checksum = 0xffffffff;
  for (const byte of buffer) {
    checksum = (checksum >>> 8) ^ crc32Table[(checksum ^ byte) & 0xff];
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const safeYear = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((safeYear - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function localHeader(entry) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(entry.dosTime, 10);
  header.writeUInt16LE(entry.dosDate, 12);
  header.writeUInt32LE(entry.crc, 14);
  header.writeUInt32LE(entry.data.length, 18);
  header.writeUInt32LE(entry.data.length, 22);
  header.writeUInt16LE(entry.name.length, 26);
  header.writeUInt16LE(0, 28);
  return header;
}

function centralHeader(entry) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(entry.dosTime, 12);
  header.writeUInt16LE(entry.dosDate, 14);
  header.writeUInt32LE(entry.crc, 16);
  header.writeUInt32LE(entry.data.length, 20);
  header.writeUInt32LE(entry.data.length, 24);
  header.writeUInt16LE(entry.name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE((0o100644 << 16) >>> 0, 38);
  header.writeUInt32LE(entry.offset, 42);
  return header;
}

function endOfCentralDirectory(entryCount, centralDirectorySize, centralDirectoryOffset) {
  const footer = Buffer.alloc(22);
  footer.writeUInt32LE(0x06054b50, 0);
  footer.writeUInt16LE(0, 4);
  footer.writeUInt16LE(0, 6);
  footer.writeUInt16LE(entryCount, 8);
  footer.writeUInt16LE(entryCount, 10);
  footer.writeUInt32LE(centralDirectorySize, 12);
  footer.writeUInt32LE(centralDirectoryOffset, 16);
  footer.writeUInt16LE(0, 20);
  return footer;
}

const sourceFiles = await collectFiles(projectRoot);
const createdAt = new Date();
const manifest = {
  archiveFormat: "zip-store",
  createdAt: createdAt.toISOString(),
  project: archiveRoot,
  version: packageJson.version,
  restore: ["npm ci", "npm run check", "npm run build"],
  excluded: ["dependencies", "build output", "Git history", "logs", "QA captures", "real environment files"],
};

const entries = [];
for (const file of sourceFiles) {
  const fileStats = await stat(file.absolutePath);
  const data = await readFile(file.absolutePath);
  entries.push({
    data,
    modifiedAt: fileStats.mtime,
    name: Buffer.from(`${archiveRoot}/${file.relativePath}`, "utf8"),
  });
}

entries.push({
  data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
  modifiedAt: createdAt,
  name: Buffer.from(`${archiveRoot}/EXPORT_MANIFEST.json`, "utf8"),
});

let localOffset = 0;
const localParts = [];
for (const entry of entries) {
  const { dosDate, dosTime } = dosDateTime(entry.modifiedAt);
  entry.crc = crc32(entry.data);
  entry.dosDate = dosDate;
  entry.dosTime = dosTime;
  entry.offset = localOffset;
  const header = localHeader(entry);
  localParts.push(header, entry.name, entry.data);
  localOffset += header.length + entry.name.length + entry.data.length;
}

const centralParts = [];
for (const entry of entries) {
  const header = centralHeader(entry);
  centralParts.push(header, entry.name);
}

const centralDirectory = Buffer.concat(centralParts);
const archive = Buffer.concat([
  ...localParts,
  centralDirectory,
  endOfCentralDirectory(entries.length, centralDirectory.length, localOffset),
]);

await mkdir(outputDirectory, { recursive: true });
const timestamp = createdAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const archiveName = `${archiveRoot}-${timestamp}.zip`;
const archivePath = path.join(outputDirectory, archiveName);
const checksum = createHash("sha256").update(archive).digest("hex");

await writeFile(archivePath, archive);
await writeFile(`${archivePath}.sha256`, `${checksum}  ${archiveName}\n`, "utf8");

console.log(`Created ${path.relative(projectRoot, archivePath)} (${entries.length} files)`);
console.log(`SHA-256 ${checksum}`);
