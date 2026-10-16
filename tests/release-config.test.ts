import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
test('nieuzgodniony administrator blokuje pakiet uruchomienia mimo znanej strony umowy',async()=>{
 const c=JSON.parse(await readFile(new URL('../shared/site-content.json',import.meta.url),'utf8'));
 assert.equal(c.contractPartyConfirmed,true);assert.equal(c.business.krs,'0000995470');assert.equal(c.dataControllerConfirmed,false);
 assert.ok(!c.documents.prywatnosc.includes('Administratorem danych związanych z obsługą Czysty Pomnik jest SO SOCIAL'));
 const dir=await mkdtemp(join(tmpdir(),'cp-release-'));
 try{execFileSync(process.execPath,['scripts/prepare-settings.mjs',dir]);const settings=JSON.parse(await readFile(join(dir,'settings.json'),'utf8'));assert.equal(settings.ready,false);assert.deepEqual(settings.documents,{});}finally{await rm(dir,{recursive:true,force:true});}
});
