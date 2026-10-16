import {test} from 'node:test';
import assert from 'node:assert/strict';
import app from '../api/index.mjs';
test('zbudowana funkcja Vercel uruchamia API w Node bez loadera TypeScript',async()=>{
 assert.equal(typeof app,'function');
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 try{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/config`);assert.equal(response.status,200);assert.equal((await response.json()).mode,'demo');}
 finally{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
