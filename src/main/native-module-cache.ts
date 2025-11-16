/**
 * Native module cache with lazy loading
 * Modules are only loaded when first accessed
 */

import { loadNativeModule } from './native-loader';

type NativeModuleName = 'llvideo' | 'llwhisper';

// Cache for loaded modules
const moduleCache = new Map<NativeModuleName, any>();

/**
 * Get native module with lazy loading and caching
 * Only loads the module on first access
 */
export function getNativeModule(moduleName: NativeModuleName): any {
  // Return from cache if already loaded
  if (moduleCache.has(moduleName)) {
    console.log(`[Native] Using cached: ${moduleName}`);
    return moduleCache.get(moduleName);
  }

  // Load module on first access
  console.log(`[Native] Lazy loading: ${moduleName}`);
  
  try {
    const module = loadNativeModule(moduleName);
    moduleCache.set(moduleName, module);
    console.log(`[Native] ✓ Successfully loaded: ${moduleName}`);
    return module;
  } catch (error: any) {
    console.error(`[Native] ✗ Failed to load ${moduleName}:`, error.message);
    console.error(`[Native] Error code:`, error.code);
    console.error(`[Native] Stack:`, error.stack);
    throw error;
  }
}

/**
 * Preload modules in advance (optional)
 * Call this after app is ready to preload modules without blocking startup
 */
export function preloadNativeModules(): void {
  console.log('[Native] Preloading modules...');
  
  try {
    getNativeModule('llvideo');
    console.log('[Native] ✓ llvideo preloaded');
  } catch (error) {
    console.error('[Native] ✗ Failed to preload llvideo:', error);
  }

  try {
    getNativeModule('llwhisper');
    console.log('[Native] ✓ llwhisper preloaded');
  } catch (error) {
    console.error('[Native] ✗ Failed to preload llwhisper:', error);
  }
}

/**
 * Clear module cache (for testing/reloading)
 */
export function clearModuleCache(): void {
  moduleCache.clear();
  console.log('[Native] Module cache cleared');
}
