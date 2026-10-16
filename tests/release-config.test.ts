import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
test('pakiet zawiera potwierdzone dane, pełne dokumenty i zgodną informację o ręcznej poczcie',async()=>{
 const c=JSON.parse(await readFile(new URL('../shared/site-content.json',import.meta.url),'utf8'));
 assert.equal(c.contractPartyConfirmed,true);assert.equal(c.dataControllerConfirmed,true);assert.equal(c.business.krs,'0000995470');assert.equal(c.mailMode,'manual');
 assert.ok(c.documents.prywatnosc.includes('Administratorem danych osobowych jest SO SOCIAL'));
 for(const key of ['regulamin','prywatnosc','odstapienie','cookies'])assert.ok(c.documents[key].length>1000);
 assert.ok(!c.documents.prywatnosc.includes('zostanie uzupełniona'));
 const dir=await mkdtemp(join(tmpdir(),'cp-release-'));
 try{execFileSync(process.execPath,['scripts/prepare-settings.mjs',dir]);const settings=JSON.parse(await readFile(join(dir,'settings.json'),'utf8'));assert.equal(settings.ready,false);assert.deepEqual(settings.documents,c.documents);}finally{await rm(dir,{recursive:true,force:true});}
});
