const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'components', 'DashboardClient.tsx');
const source = fs.readFileSync(file, 'utf8');
const required = [
  'function SavedValueInput',
  'function uniqueSavedValues',
  'list={`${id}-saved-values`}',
  '<datalist id={`${id}-saved-values`}>',
  'const savedTypes=uniqueSavedValues((items||[]).map((i:Any)=>i.itemType),[\'General\'])',
  'const savedUnits=uniqueSavedValues((items||[]).map((i:Any)=>i.measurementUnit),MEASUREMENT_UNITS)',
  'const savedCategories=uniqueSavedValues(categories||[])',
  '<ItemModal item={selected} items={items} stores={stores} categories={data.categories}',
];
const missing = required.filter(x => !source.includes(x));
if (missing.length) {
  console.error('Item autocomplete check failed. Missing:', missing);
  process.exit(1);
}
if (!source.includes('You can select a suggestion or enter a new value.')) {
  console.error('Item autocomplete check failed: free-text guidance missing.');
  process.exit(1);
}
console.log('Item autocomplete check passed: type-ahead saved values + free-text entry are wired for item type, category, and measurement unit.');
