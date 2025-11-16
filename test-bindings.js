const bindings = require('bindings');

try {
  console.log('Trying to load llvideo with bindings...');
  const mod = bindings('llvideo');
  console.log('SUCCESS!');
  console.log('Exports:', Object.keys(mod));
} catch (e) {
  console.log('FAILED');
  console.log('Error:', e.message);
  if (e.tried) {
    console.log('\nTried paths:');
    e.tried.forEach(p => console.log('  -', p));
  }
}
