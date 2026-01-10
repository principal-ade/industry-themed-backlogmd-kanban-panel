#!/usr/bin/env tsx
/**
 * Generate mock data from a real Backlog.md repository
 *
 * Usage: tsx scripts/generate-real-repo-mock.ts <path-to-repo>
 */

import * as fs from 'fs';
import * as path from 'path';

const repositoryPath = process.argv[2] || '/Users/griever/Developer/industry-themed-panels/industry-themed-agent-skills-panel';

console.log(`Generating mock data from: ${repositoryPath}`);

// Recursively get all files in a directory
const getAllFiles = (dirPath: string, arrayOfFiles: string[] = []): string[] => {
  try {
    const files = fs.readdirSync(dirPath);

    files.forEach((file: string) => {
      const fullPath = path.join(dirPath, file);
      if (fs.statSync(fullPath).isDirectory()) {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      } else {
        // Store relative path from repository root
        const relativePath = path.relative(repositoryPath, fullPath);
        arrayOfFiles.push(relativePath);
      }
    });
  } catch (err) {
    console.warn(`Could not read directory ${dirPath}:`, err);
  }

  return arrayOfFiles;
};

// Get all files from the backlog directory
const backlogPath = path.join(repositoryPath, 'backlog');
let allFiles: string[] = [];

try {
  allFiles = getAllFiles(backlogPath);
  console.log(`Found ${allFiles.length} files in backlog/`);
} catch (err) {
  console.error('Error reading repository:', err);
  process.exit(1);
}

// Read file contents
const fileContents: Record<string, string> = {};

allFiles.forEach(filePath => {
  try {
    const fullPath = path.join(repositoryPath, filePath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    fileContents[filePath] = content;
    console.log(`Loaded: ${filePath} (${content.length} bytes)`);
  } catch (err) {
    console.warn(`Could not read ${filePath}:`, err);
  }
});

// Generate TypeScript file
const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const outputPath = path.join(scriptDir, '../src/panels/kanban/mocks/realRepoData.ts');
const repoName = path.basename(repositoryPath);

const tsContent = `/**
 * Auto-generated mock data from real repository
 * Generated from: ${repositoryPath}
 * Generated at: ${new Date().toISOString()}
 *
 * To regenerate: tsx scripts/generate-real-repo-mock.ts <path-to-repo>
 */

export const REAL_REPO_NAME = '${repoName}';
export const REAL_REPO_PATH = '${repositoryPath}';

export const realRepoFilePaths: string[] = ${JSON.stringify(allFiles, null, 2)};

export const realRepoFileContents: Record<string, string> = ${JSON.stringify(fileContents, null, 2)};
`;

fs.writeFileSync(outputPath, tsContent, 'utf-8');
console.log(`\n✅ Generated: ${outputPath}`);
console.log(`   - ${allFiles.length} file paths`);
console.log(`   - ${Object.keys(fileContents).length} file contents`);
console.log(`\nNow you can use this data in your Storybook stories!`);
