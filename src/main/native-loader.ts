import * as path from 'path';
import { app } from 'electron';
import * as fs from 'fs';

/**
 * Get the directory containing native modules and DLLs
 */
export function getNativeModuleDir(): string {
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'build',
      'Release'
    );
  } else {
    // Prefer the node-gyp / LLAlpcEditor layout where native addons live under native/build/Release
    const nativeGypPath = path.join(app.getAppPath(), 'native', 'build', 'Release');
    const projectGypPath = path.join(app.getAppPath(), 'build', 'Release');
    const cmakePath = path.join(app.getAppPath(), 'build', 'bin', 'Release');

    // Check in order of preference: native/node-gyp -> project node-gyp -> cmake-js
    if (fs.existsSync(nativeGypPath)) {
      return nativeGypPath;
    } else if (fs.existsSync(projectGypPath)) {
      return projectGypPath;
    } else if (fs.existsSync(cmakePath)) {
      return cmakePath;
    } else {
      // Default to native node-gyp path (LLAlpcEditor style)
      return nativeGypPath;
    }
  }
}

/**
 * Get the correct path to native modules
 * Handles both development and production environments
 */
export function getNativeModulePath(moduleName: 'llvideo' | 'llwhisper'): string {
  return path.join(getNativeModuleDir(), `${moduleName}.node`);
}

/**
 * Setup DLL search path and preload DLLs on Windows
 */
function setupDllPath(): void {
  if (process.platform !== 'win32') return;
  
  const dllDir = getNativeModuleDir();
  
  // Check if directory exists before trying to access it
  if (!fs.existsSync(dllDir)) {
    console.warn(`[DLL] Directory not found: ${dllDir}`);
    console.warn('[DLL] Native modules may not be built yet. Run: npm run build:native');
    return;
  }
  
  try {
    // Method 1: Add to PATH environment variable
    const currentPath = process.env.PATH || '';
    if (!currentPath.includes(dllDir)) {
      process.env.PATH = `${dllDir};${currentPath}`;
      console.log(`[DLL] Added to PATH: ${dllDir}`);
    }
    
    // Method 2: Use process.addDllDirectory (Node.js 15.0.0+)
    // This is the most reliable way on Windows
    if (typeof (process as any).addDllDirectory === 'function') {
      try {
        (process as any).addDllDirectory(dllDir);
        console.log(`[DLL] Added via addDllDirectory: ${dllDir}`);
      } catch (e) {
        console.warn('[DLL] addDllDirectory failed:', e);
      }
    }
    
    // List available DLLs for debugging
    const dlls = fs.readdirSync(dllDir).filter(f => f.endsWith('.dll'));
    console.log(`[DLL] Found ${dlls.length} DLLs:`, dlls.join(', '));
    
  } catch (error) {
    console.error('[DLL] Setup failed:', error);
    // Don't throw - let the app start even if DLL setup fails
    console.warn('[DLL] Continuing without DLL path setup');
  }
}

// Initialize DLL path BEFORE any native modules are loaded
setupDllPath();

/**
 * Try to load using bindings package (standard method for Node.js native addons)
 */
function tryBindings(moduleName: string): any | null {
  try {
    const bindings = require('bindings');
    console.log(`[Native] Trying bindings for: ${moduleName}`);
    return bindings(moduleName);
  } catch (error: any) {
    console.warn(`[Native] bindings() failed:`, error.message);
    return null;
  }
}

/**
 * Load native module safely with proper error handling
 */
export function loadNativeModule(moduleName: 'llvideo' | 'llwhisper'): any {
  try {
    // Method 1: Try using bindings (recommended for Electron)
    const bindingsModule = tryBindings(moduleName);
    if (bindingsModule) {
      console.log(`[Native] ✓ Loaded ${moduleName} via bindings`);
      return bindingsModule;
    }
    
    // Method 2: Fall back to direct require with path
    const modulePath = getNativeModulePath(moduleName);
    console.log(`[Native] Trying direct require: ${modulePath}`);
    
    // Check if module file exists
    if (!fs.existsSync(modulePath)) {
      throw new Error(
        `Native module not found at: ${modulePath}\n` +
        `Please run: npm run build:native`
      );
    }
    
    // Check if DLLs exist
    const dllDir = getNativeModuleDir();
    const requiredDlls = [
      'avcodec-61.dll',
      'avformat-61.dll',
      'avutil-59.dll',
      'swresample-5.dll'
    ];
    
    const missingDlls = requiredDlls.filter(dll => !fs.existsSync(path.join(dllDir, dll)));
    if (missingDlls.length > 0) {
      console.warn(`[Native] Warning: Missing DLLs: ${missingDlls.join(', ')}`);
    }
    
    const module = require(modulePath);
    console.log(`[Native] ✓ Loaded ${moduleName} via direct require`);
    return module;
  } catch (error: any) {
    console.error(`[Native] ✗ Failed to load ${moduleName}.node:`, error);
    throw new Error(
      `无法加载 ${moduleName} 模块: ${error.message}\n` +
      `请确保:\n` +
      `1. 已编译 Native 模块: npm run build:native\n` +
      `2. FFmpeg DLL 文件存在于 build/bin/Release/ 目录`
    );
  }
}
