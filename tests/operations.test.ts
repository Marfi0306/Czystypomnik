import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groszeInput,zlotyInput,workScope} from '../shared/operations';
import {passwordHash} from '../server/crew';
test('kwoty panelu używają złotych i przeliczają przecinek bez utraty grosza',()=>{assert.equal(zlotyInput(19900),'199,00');assert.equal(groszeInput('199,00'),19900);assert.equal(groszeInput('75,51'),7551);assert.equal(groszeInput('449.9'),44990);for(const s of ['199,999','-1','1e4','0','x'])assert.throws(()=>groszeInput(s),/INVALID_AMOUNT/);});
test('hasła są solone i nigdy nie przechowują oryginalnego tekstu',async()=>{const a=await passwordHash('test-working-password','salt-a');assert.equal(a.length,128);assert.equal(await passwordHash('test-working-password','salt-a'),a);assert.notEqual(await passwordHash('test-working-password','salt-b'),a);});
test('zakres Gold rozwija wszystkie czynności Silver, a indywidualny zakres ma pierwszeństwo',()=>{const o:any={package_snapshot:{name:'Gold',features:['Wszystko, co zawiera pakiet Silver','Dwa nowe szklane znicze']}};assert.ok(workScope(o).includes('Ręczne mycie pojedynczego nagrobka'));assert.ok(workScope(o).includes('Dwa nowe szklane znicze'));o.scope='Indywidualny zakres';assert.deepEqual(workScope(o),['Indywidualny zakres']);});
