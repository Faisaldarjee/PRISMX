import { spawnSync } from 'child_process';

console.log('Attempting to install Python packages...');
const packages = ['fastapi', 'uvicorn', 'sqlalchemy', 'pandas', 'yfinance', 'pandas-ta', 'xgboost', 'river', 'scikit-learn', 'beautifulsoup4'];

const result = spawnSync('python3', ['-m', 'pip', 'install', ...packages], { encoding: 'utf-8' });
console.log('Install result:', result.stdout || result.stderr);
