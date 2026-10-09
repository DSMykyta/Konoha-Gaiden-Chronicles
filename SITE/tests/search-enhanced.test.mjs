import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '../public/search-enhanced.js'), 'utf8');

function loadSearchApi() {
  const context = { setTimeout, clearTimeout, console };
  vm.createContext(context);
  vm.runInContext(`${source}\n;globalThis.SearchApi = TimelineSearchEnhanced;`, context, { filename: 'search-enhanced.js' });
  return context.SearchApi;
}

test('search normalization preserves Ukrainian distinctions and normalizes transliteration marks', () => {
  const search = loadSearchApi();
  assert.equal(search.normalize('Raidō Ґай Їжак Йондайме'), 'raido гай їжак йондайме');
});

test('search understands numeric and Ukrainian calendar dates', () => {
  const search = loadSearchApi();
  assert.equal(search.parseDate('22.01').day, 21);
  assert.equal(search.parseDate('усі події 1 серпня').day, 212);
});

test('search recognizes hierarchy intent from natural Ukrainian queries', () => {
  const search = loadSearchApi();
  assert.equal(search.inferType('сцени з Райдо'), 'scene');
  assert.equal(search.inferType('арка вторгнення'), 'arc');
  assert.equal(search.parseIntent('що було перед вторгненням').relation, 'перед');
});

test('fuzzy matching tolerates short misspellings', () => {
  const search = loadSearchApi();
  assert.ok(search.similarity('какаш', 'какаші') > 0.85);
  assert.ok(search.similarity('райдо', 'райдо') > 0.99);
});

test('search panel is wired to the enhanced module and shared card components', () => {
  const html = fs.readFileSync(path.join(here, '../public/index.html'), 'utf8');
  assert.match(html, /search-enhanced\.js/);
  assert.match(html, /id="searchPanel"[^>]*class="panel left-panel"/);
  assert.match(html, /class="card-top search-panel-header"/);
  assert.match(html, /id="searchResults" class="story-children search-results"/);
  for (const kind of ['all','moment','scene','episode','arc','person','location']) {
    assert.match(html, new RegExp(`data-search-type="${kind}"`));
  }
});

test('search uses only the enhanced module and reports load or runtime errors', () => {
  const app = fs.readFileSync(path.join(here, '../public/app.js'), 'utf8');
  const block = app.match(/function search\(\)\{[\s\S]*?\n\}(?=\nfunction openProfile\()/)?.[0];
  assert.ok(block, 'the search entrypoint must be present');
  assert.doesNotMatch(block, /orderedScenes\(\)|data-search-event|StoryLayers\.compose/, 'no silent legacy results');
  assert.doesNotMatch(app, /if\(!window\.TimelineSearchEnhanced\).*addEventListener/, 'no legacy input listener');

  const elements = {
    searchSummary: { textContent: '' },
    searchResults: { innerHTML: '' },
    moreResults: { hidden: false }
  };
  const context = {
    window: {},
    $: id => elements[id],
    console: { error() {} }
  };
  vm.createContext(context);
  vm.runInContext(block + '\nsearch();', context);
  assert.match(elements.searchSummary.textContent, /Пошук тимчасово недоступний/);
  assert.match(elements.searchResults.innerHTML, /role="alert"/);
  assert.equal(elements.moreResults.hidden, true);

  let renders = 0;
  context.window.TimelineSearchEnhanced = { render() { renders++; } };
  vm.runInContext('search();', context);
  assert.equal(renders, 1);

  context.window.TimelineSearchEnhanced = { render() { throw new Error('search failed'); } };
  elements.moreResults.hidden = false;
  vm.runInContext('search();', context);
  assert.match(elements.searchResults.innerHTML, /Не вдалося запустити пошук/);
  assert.equal(elements.moreResults.hidden, true);
});
