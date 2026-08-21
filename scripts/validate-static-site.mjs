#!/usr/bin/env node
/**
 * Static-site production validator for A. Silva Innovations.
 *
 * No npm dependencies. Designed for GitHub Actions and local CI.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const REQUIRED = [
  "index.html",
  "portfolio.html",
  "credentials.json",
  "manifest.webmanifest",
  "sw.js",
  "assets/css/core.css",
  "assets/css/components.css",
  "assets/css/visualizations.css",
  "assets/asilva-widget.js",
  "assets/data/system-architecture.json",
];

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function normalizeLocalUrl(raw) {
  if (!raw) return null;
  const value = raw.trim();
  if (
    value.startsWith("#") ||
    value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:") ||
    value.startsWith("data:") ||
    value.startsWith("blob:")
  ) return null;
  return value.split("#")[0].split("?")[0];
}

function validateJson(rel) {
  try {
    JSON.parse(read(rel));
  } catch (error) {
    fail(`${rel}: invalid JSON — ${error.message}`);
  }
}

function validateHtml(rel) {
  const html = read(rel);

  // Detect a '<' appearing inside a <link ...> tag before its closing '>'.
  // This catches the known malformed visualization stylesheet declaration.
  const linkOpen = /<link\b/gi;
  let match;
  while ((match = linkOpen.exec(html))) {
    const end = html.indexOf(">", match.index);
    const nextTag = html.indexOf("<", match.index + 5);
    if (end === -1) {
      fail(`${rel}: unterminated <link> element near offset ${match.index}`);
      break;
    }
    if (nextTag !== -1 && nextTag < end) {
      fail(`${rel}: malformed <link> element near offset ${match.index}`);
      break;
    }
  }

  const refs = [];
  const patterns = [
    /\b(?:href|src|content)=["']([^"']+)["']/gi,
  ];

  for (const pattern of patterns) {
    for (const m of html.matchAll(pattern)) {
      const local = normalizeLocalUrl(m[1]);
      if (local) refs.push(local);
    }
  }

  for (const local of refs) {
    const candidate = path.normalize(path.join(path.dirname(path.join(ROOT, rel)), local));
    if (!candidate.startsWith(ROOT)) {
      fail(`${rel}: unsafe local reference "${local}"`);
      continue;
    }
    if (!fs.existsSync(candidate)) {
      fail(`${rel}: missing local reference "${local}"`);
    }
  }

  if (!/<html\b[^>]*\blang=["'][a-z]{2,}([-_][A-Z]{2})?["']/i.test(html)) {
    fail(`${rel}: missing or invalid html lang attribute`);
  }

  if (!/<meta\b[^>]*name=["']viewport["']/i.test(html)) {
    fail(`${rel}: missing viewport meta tag`);
  }
}

for (const rel of REQUIRED) {
  if (!exists(rel)) fail(`Missing required file: ${rel}`);
}

for (const rel of ["credentials.json", "manifest.webmanifest", "assets/data/system-architecture.json"]) {
  if (exists(rel)) validateJson(rel);
}

for (const file of walk(ROOT)) {
  if (file.endsWith(".html")) {
    validateHtml(path.relative(ROOT, file));
  }
}

if (exists("manifest.webmanifest")) {
  try {
    const manifest = JSON.parse(read("manifest.webmanifest"));
    for (const key of ["name", "short_name", "start_url", "display"]) {
      if (!manifest[key]) fail(`manifest.webmanifest: missing "${key}"`);
    }
  } catch {
    // JSON validation above already reports the parse failure.
  }
}

if (warnings.length) {
  console.log("\nWarnings:");
  for (const message of warnings) console.log(`  ⚠ ${message}`);
}

if (failures.length) {
  console.error("\nStatic-site validation FAILED:");
  for (const message of failures) console.error(`  ✖ ${message}`);
  process.exit(1);
}

console.log("Static-site validation PASSED.");
console.log(`Validated required files and ${walk(ROOT).filter((f) => f.endsWith(".html")).length} HTML document(s).`);
