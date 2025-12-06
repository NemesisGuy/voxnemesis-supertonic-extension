#!/usr/bin/env node
/**
 * Fetch Supertonic assets from Hugging Face into ./assets.
 * - Clones https://huggingface.co/Supertone/supertonic into assets/
 * - Removes its .git folder to avoid nested repos
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');
const repoUrl = 'https://huggingface.co/Supertone/supertonic';

async function run() {
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
    }

    // Remove any previous contents except README
    for (const entry of fs.readdirSync(assetsDir)) {
        if (entry.toLowerCase() === 'readme.md') continue;
        fs.rmSync(path.join(assetsDir, entry), { recursive: true, force: true });
    }

    console.log('Cloning models from', repoUrl);
    await exec('git', ['clone', '--depth=1', repoUrl, assetsDir]);

    // Strip nested git metadata to keep the workspace clean
    const gitDir = path.join(assetsDir, '.git');
    if (fs.existsSync(gitDir)) {
        fs.rmSync(gitDir, { recursive: true, force: true });
    }

    console.log('Assets ready in', assetsDir);
}

function exec(cmd, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { stdio: 'inherit' });
        child.on('exit', code => {
            if (code === 0) resolve();
            else reject(new Error(`${cmd} ${args.join(' ')} failed with code ${code}`));
        });
        child.on('error', reject);
    });
}

run().catch(err => {
    console.error('Fetch failed:', err.message);
    process.exit(1);
});
