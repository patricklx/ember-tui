import { resolve as resolvePath, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { existsSync, readdirSync, statSync, readFileSync, realpathSync } from 'fs';
import { cwd } from 'process';
import { transformSync } from '@babel/core';
import babelConfig from './babel.config.cjs';
import { Preprocessor } from 'content-tag';

const contentTagProcessor = new Preprocessor();

const __dirname = cwd();

// Get ember-source path
const emberSourcePath = resolvePath(__dirname, 'node_modules/ember-source/dist/packages');

// Get all @glimmer packages
const glimmerPath = resolvePath(emberSourcePath, '@glimmer');
const glimmerDirs = existsSync(glimmerPath) ? readdirSync(glimmerPath) : [];

// Helper function to try multiple extensions
function tryExtensions(basePath, extensions = ['js', 'ts', 'gts']) {
  // Try with extensions first
	basePath = basePath.replace('.js', '');
  for (const ext of extensions) {
    const fullPath = `${basePath}.${ext}`;
    if (existsSync(fullPath)) {
      try {
        const stats = statSync(fullPath);
        if (stats.isFile()) {
          return fullPath;
        }
      } catch (e) {
        // Continue to next extension
      }
    }
  }

  // Try index files
  for (const ext of extensions) {
    const indexPath = resolvePath(basePath, `index.${ext}`);
    if (existsSync(indexPath)) {
      try {
        const stats = statSync(indexPath);
        if (stats.isFile()) {
          return indexPath;
        }
      } catch (e) {
        // Continue to next extension
      }
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // Handle @ember/* imports
  if (specifier.startsWith('@ember/')) {
    const basePath = resolvePath(emberSourcePath, specifier);
    const resolved = tryExtensions(basePath);

    if (resolved) {
      return {
        url: pathToFileURL(resolved).href,
        shortCircuit: true,
      };
    }
  }

  // Handle @glimmer/* imports
  if (specifier.startsWith('@glimmer/')) {
    const glimmerPackage = specifier.replace('@glimmer/', '');
    if (glimmerDirs.includes(glimmerPackage)) {
      const basePath = resolvePath(glimmerPath, glimmerPackage);
      const resolved = tryExtensions(basePath);
      if (resolved) {
        return {
          url: pathToFileURL(resolved).href,
          shortCircuit: true,
        };
      }
    }
  }

  // Handle ember imports
  if (specifier === 'ember') {
    const basePath = resolvePath(emberSourcePath, 'ember');
    const resolved = tryExtensions(basePath);
    if (resolved) {
      return {
        url: pathToFileURL(resolved).href,
        shortCircuit: true,
      };
    }
  }

  // Handle relative/absolute imports with extension checking
  if (specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/')) {
    const parentURL = context.parentURL ? fileURLToPath(context.parentURL) : __dirname;
    const parentDir = dirname(parentURL);
    const basePath = resolvePath(parentDir, specifier);

    // Try to resolve with multiple extensions
    const resolved = tryExtensions(basePath);
    if (resolved) {
      return {
        url: pathToFileURL(resolved).href,
        shortCircuit: true,
      };
    }
  }

  // Let Node.js handle all other specifiers
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
	let filePath = url;
	try {
		filePath = fileURLToPath(url);
		filePath = realpathSync(filePath);
	} catch (e) {

	}

  // Check if file needs transpilation
  if (filePath.endsWith('.ts') || filePath.endsWith('.gts') || filePath.endsWith('.js')) {
    // Skip node_modules except for specific cases
    if (filePath.includes('node_modules') && !filePath.includes('ember-source')) {
      return nextLoad(url, context);
    }

    // Set format to 'module' for .gts files to prevent format detection error
    if (filePath.endsWith('.gts')) {
      context = { ...context, format: 'module' };
    }

    try {
      let source = readFileSync(filePath, 'utf-8');
      let processedFilename = filePath;

      // Pre-process .gts files with content-tag first
      if (filePath.endsWith('.gts')) {
        try {
          const processed = contentTagProcessor.process(source);
          source = processed.code;
          // Change filename to .ts for Babel to process it correctly
          processedFilename = filePath.replace(/\.gts$/, '.ts');
        } catch (contentTagError) {
          console.error(`Error processing content-tag for ${filePath}:`, contentTagError.message);
          throw contentTagError;
        }
      }

      // Transpile with Babel
      const result = transformSync(source, {
        ...babelConfig,
        filename: processedFilename,
        sourceMaps: 'inline',
      });

      if (result && result.code) {
        return {
          format: 'module',
          source: result.code,
          shortCircuit: true,
        };
      }
    } catch (error) {
      console.error(`Error transpiling ${filePath}:`, error.message);
      if (error.stack) {
        console.error(error.stack);
      }
      throw error;
    }
  }

  // Let Node.js handle all other files
  return nextLoad(url, context);
}
