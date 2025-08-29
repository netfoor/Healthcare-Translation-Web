const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const lambdaDirs = ['connect', 'disconnect', 'message'];

console.log('Building Lambda functions...');

lambdaDirs.forEach(dir => {
  const lambdaPath = path.join(__dirname, 'lambda', dir);
  
  console.log(`Building ${dir} Lambda...`);
  
  // Install dependencies
  try {
    execSync('npm install', { cwd: lambdaPath, stdio: 'inherit' });
  } catch (error) {
    console.error(`Failed to install dependencies for ${dir}:`, error.message);
  }
  
  // Compile TypeScript to JavaScript
  try {
    execSync('npx tsc index.ts --target ES2020 --module commonjs --esModuleInterop --skipLibCheck', { 
      cwd: lambdaPath, 
      stdio: 'inherit' 
    });
    console.log(`✓ ${dir} Lambda built successfully`);
  } catch (error) {
    console.error(`Failed to build ${dir} Lambda:`, error.message);
  }
});

console.log('Lambda build complete!');