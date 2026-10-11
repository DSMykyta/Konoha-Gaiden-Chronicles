import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const config=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));

test('a manually requested deployment never gets skipped for a data-only or earlier commit change',()=>{
 // Automatic Git deployments are intentionally disabled on the Hobby plan.
 // Thus an explicit manual deployment must build the checked-out source,
 // even when the latest commit is in CHRONOLOGY/data or is documentation-only.
 assert.equal(config.git?.deploymentEnabled,false);
 assert.equal(config.ignoreCommand,'exit 1');
 assert.equal(config.buildCommand,'npm run check && npm test');
 assert.equal(config.outputDirectory,'public');
});
