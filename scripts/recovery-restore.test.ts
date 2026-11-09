import { chmodSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { runRestore } from "./recovery-restore.mjs";

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory,{recursive:true,force:true}); });
function fixture(objects = 0, decryptBody = "process.stdin.pipe(process.stdout);") {
 const dir=mkdtempSync(join(tmpdir(),"recovery-restore-test-")); chmodSync(dir,0o700); directories.push(dir);
 const bin=(name:string,body:string)=>{ const path=join(dir,name);writeFileSync(path,`#!${process.execPath}\nif(process.argv.includes('--version')) console.log('${name} (PostgreSQL) 18.6'); else {${body}}`,{mode:0o700}); return path; };
 const file=(name:string,content:string)=>{const path=join(dir,name);writeFileSync(path,content,{mode:0o600});return path;};
 const restored=join(dir,"restored");
 return {
  sourceHost:"ep-source-123.c-5.eu-central-1.aws.neon.tech",
  targetHost:"ep-target-123.c-8.eu-central-1.aws.neon.tech",database:"neondb",user:"neondb_owner",service:"recovery_source",
  serviceFile:file("services.conf",""),passwordFile:file("passwords.conf",""),identityFile:file("identity","synthetic identity"),
  archive:file("archive.age","synthetic archive"),sha256:createHash("sha256").update("synthetic archive").digest("hex"),
  age:bin("age",decryptBody),pgRestore:bin("pg_restore",`if(!process.argv.includes('--single-transaction')||!process.argv.includes('--exit-on-error')||!process.argv[process.argv.indexOf('--dbname')+1].includes('host=ep-target-123.c-8.eu-central-1.aws.neon.tech')) process.exit(3); process.stdin.on('data', c=>require('node:fs').appendFileSync(${JSON.stringify(restored)},c));`),
  psql:bin("psql",`console.log(JSON.stringify({database:'neondb',role:'neondb_owner',major:18,objects:${objects}}));`),
 };
}
it("plans without database contact",async()=>{ expect(await runRestore(fixture())).toEqual({status:"planned",databaseContacted:false}); });
it("refuses source=target, wrong archive checksum and nonempty target",async()=>{
 const config=fixture();
 await expect(runRestore({...config,targetHost:config.sourceHost},{execute:true})).rejects.toThrow();
 await expect(runRestore({...config,sha256:"0".repeat(64)},{execute:true})).rejects.toThrow();
 await expect(runRestore(fixture(1),{execute:true})).rejects.toThrow();
});
it("streams only into the pinned empty target with single-transaction restore",async()=>{
 const config=fixture();expect(await runRestore(config,{execute:true})).toEqual({status:"restored",validationRequired:true});
 expect(readFileSync(join(config.archive, "..", "restored"),"utf8")).toBe("synthetic archive");
});
it("fails closed on decryption errors without exposing stderr",async()=>{
 const config=fixture(0,"process.stdout.write('partial');process.stderr.write('synthetic-secret');process.exit(2);");
 await expect(runRestore(config,{execute:true})).rejects.toThrow(/^Recovery restore failed$/);
 expect(existsSync(join(config.archive,"..","restored"))).toBe(false);
});

it("bounds a stalled decryption before writing to the target",async()=>{
 const config=fixture(0,"setInterval(()=>{},1000);");
 await expect(runRestore(config,{execute:true,timeoutMs:150})).rejects.toThrow(/^Recovery restore failed$/);
 expect(existsSync(join(config.archive,"..","restored"))).toBe(false);
});
