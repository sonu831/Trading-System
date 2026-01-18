const { MTicker } = require('@mstock-mirae-asset/nodetradingapi-typeb');

console.log('--- MTicker Prototype Inspection ---');
console.log('Methods:', Object.getOwnPropertyNames(MTicker.prototype));

const dummyConfig = { api_key: 'test', access_token: 'test' };
try {
  const t = new MTicker(dummyConfig);
  console.log('\n--- Instance Inspection (Config Arg) ---');
  console.log('Has .on method?', typeof t.on === 'function');
  console.log('Has .onConnect property?', typeof t.onConnect !== 'undefined');
  console.log('Keys:', Object.keys(t));
} catch (e) {
  console.log('Failed to init with Config:', e.message);
}

try {
  const t2 = new MTicker('key', 'token');
  console.log('\n--- Instance Inspection (Positional Args) ---');
  console.log('Created successfully? (Unexpected)');
} catch (e) {
  console.log('\n--- Instance Inspection (Positional Args) ---');
  console.log('Failed as expected:', e.message);
}
