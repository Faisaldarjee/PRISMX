import { spawnSync } from 'child_process';

const result = spawnSync('python3', ['--version'], { encoding: 'utf-8' });
console.log('Python version:', result.stdout || result.stderr);

const pipResult = spawnSync('pip3', ['--version'], { encoding: 'utf-8' });
console.log('Pip version:', pipResult.stdout || pipResult.stderr);
