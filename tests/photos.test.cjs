const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadRecipes() {
  const context = {};
  vm.runInNewContext(fs.readFileSync('recipes.js', 'utf8') + '\n' + fs.readFileSync('recipes-extra.js', 'utf8') + '\nglobalThis.__recipes = RECIPES;', context);
  return context.__recipes;
}

test('all recipe records are present and complete', () => {
  const recipes = loadRecipes();
  assert.equal(recipes.length, 50);
  assert.equal(new Set(recipes.map(r => r.id)).size, recipes.length);
  for (const recipe of recipes) {
    assert.ok(recipe.name && recipe.description, `missing title/description: ${recipe.id}`);
    assert.ok(/^https:\/\//.test(recipe.image), `non-HTTPS primary image: ${recipe.id}`);
    assert.ok(/^https:\/\//.test(recipe.fallbackImage), `non-HTTPS fallback image: ${recipe.id}`);
    assert.ok(!Object.keys(recipe).some(key => key.startsWith('https://')), `unexpected URL-key property: ${recipe.id}`);
  }
});

test('each recipe has its own primary photo URL', () => {
  const recipes = loadRecipes();
  assert.equal(new Set(recipes.map(r => r.image)).size, recipes.length);
});

test('fallback handling retries only its own configured photo then shows recipe-specific placeholder', () => {
  const app = fs.readFileSync('app.js', 'utf8');
  assert.match(app, /function showImagePlaceholder\(img\)/);
  assert.match(app, /function attachImageFallback\(root\)/);
  assert.match(app, /img\.dataset\.fallbackUsed='true'/);
  assert.match(app, /showImagePlaceholder\(img\)/);
  assert.doesNotMatch(app, /fallbacks\[recipe\.category\]/);
});
