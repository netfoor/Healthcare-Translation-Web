const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Lambda directories to build
const lambdaDirs = [
  'lambda/connect',
  'lambda/disconnect', 
  'lambda/message',
  'lambda/transcribe-medical',
  'lambda/medical-vocabulary',
  'lambda/service-monitor'
];

console.log('Building Lambda functions...');

lambdaDirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  
  if (fs.existsSync(fullPath)) {
    console.log(`Building ${dir}...`);
    
    // Check if there's a package.json in the lambda directory
    const packageJsonPath = path.join(fullPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        execSync('npm install', { cwd: fullPath, stdio: 'inherit' });
        console.log(`✓ Built ${dir}`);
      } catch (error) {
        console.error(`✗ Failed to build ${dir}:`, error.message);
      }
    } else {
      console.log(`✓ ${dir} (no package.json, using parent dependencies)`);
    }
  } else {
    console.log(`⚠ ${dir} directory not found`);
  }
});

console.log('Lambda build process completed.');