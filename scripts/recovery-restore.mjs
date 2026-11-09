/** Isolated-target restore only. Execution requires separate exact-target approval. */
import { execFile, execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, readFileSync, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { childEnvironment, privatePath } from "./recovery-backup.mjs";

const fields = ["sourceHost","targetHost","database","user","service","serviceFile","passwordFile","identityFile","archive","sha256","age","pgRestore","psql"];
export function validateRestore(config) {
  if (!config || Object.keys(config).length !== fields.length || fields.some((key) => typeof config[key] !== "string")) throw new Error("Invalid restore configuration");
  for (const key of ["sourceHost","targetHost"]) {
    if (!/^ep-[a-z0-9-]+(?:\.c-[0-9]+)?\.eu-central-1\.aws\.neon\.tech$/.test(config[key]) || config[key].includes("-pooler.")) throw new Error("Invalid restore configuration");
  }
  if (config.sourceHost === config.targetHost || !/^[a-f0-9]{64}$/.test(config.sha256)) throw new Error("Invalid restore configuration");
  for (const key of ["database","user","service"]) if (!/^[a-zA-Z_][a-zA-Z0-9_-]{0,62}$/.test(config[key])) throw new Error("Invalid restore configuration");
  for (const key of ["serviceFile","passwordFile","identityFile","archive","age","pgRestore","psql"]) {
    if (!isAbsolute(config[key]) || config[key].split("/").some((part) => part.startsWith(".env")) || /[\r\n\0]/.test(config[key])) throw new Error("Invalid restore configuration");
  }
}

export function targetConnection(config, readOnly = true) {
  return `service=${config.service} host=${config.targetHost} hostaddr='' port=5432 dbname=${config.database} user=${config.user} sslmode=verify-full sslrootcert=system channel_binding=require connect_timeout=10 options='-c default_transaction_read_only=${readOnly ? "on" : "off"} -c statement_timeout=120000 -c lock_timeout=5000'`;
}

export async function privatePsql(config, sql, readOnly = true) {
  return new Promise((resolveOutput, rejectOutput) => {
    const child = execFile(config.psql, ["-X", "--quiet", "--no-align", "--tuples-only", "--no-password", "--set", "ON_ERROR_STOP=1", "--dbname", targetConnection(config,readOnly)], {
      env:childEnvironment(config), timeout:180000, maxBuffer:16*1024*1024,
    }, (error, stdout, stderr) => {
      if (error || stderr) rejectOutput(new Error("Private database check failed"));
      else resolveOutput(stdout);
    });
    child.stdin.on("error", () => { /* Do not propagate driver errors or credentials. */ });
    child.stdin.end(sql);
  });
}

const emptyTargetSql = `BEGIN READ ONLY;
SELECT json_build_object('database',current_database(),'role',current_user,'major',current_setting('server_version_num')::int/10000,'objects',
 (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema') +
 (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'));
COMMIT;`;

export async function runRestore(config, { execute=false, timeoutMs=1_200_000, signal }={}) {
  validateRestore(config);
  if (!execute) return {status:"planned",databaseContacted:false};
  const children=[];
  const controller=new AbortController();
  const stop=()=>{controller.abort();for(const child of children) child.kill("SIGKILL");};
  let timer;
  try {
    for(const key of ["serviceFile","passwordFile","identityFile","archive"]) privatePath(config[key]);
    for(const command of [config.age,config.pgRestore,config.psql]) {
      const info=lstatSync(realpathSync(command));
      if(!info.isFile() || (info.mode & 0o022)!==0) throw new Error();
    }
    for(const [command,label] of [[config.pgRestore,"pg_restore"],[config.psql,"psql"]]) {
      const output=execFileSync(command,["--version"],{env:childEnvironment(config),encoding:"utf8",timeout:5000,maxBuffer:1024,stdio:["ignore","pipe","ignore"]});
      if (!output.startsWith(`${label} (PostgreSQL) 18.`)) throw new Error();
    }
    const hash=createHash("sha256");
    for await(const chunk of createReadStream(config.archive)) hash.update(chunk);
    if(hash.digest("hex")!==config.sha256 || signal?.aborted) throw new Error();
    timer=setTimeout(stop,timeoutMs);
    signal?.addEventListener("abort",stop,{once:true});
    if(signal?.aborted) throw new Error();
    const launch=(command,args,discardOutput=true)=>{
      const child=spawn(command,args,{env:childEnvironment(config),shell:false,stdio:["pipe","pipe","pipe"]});children.push(child);
      let stderrBytes=0;child.stderr.on("data",chunk=>{stderrBytes+=chunk.length;});if(discardOutput) child.stdout.resume();
      const done=new Promise((ok,fail)=>{child.on("error",()=>fail(new Error("Process failed")));child.on("close",code=>code===0&&stderrBytes===0?ok(undefined):fail(new Error("Process failed")));});
      done.catch(stop);return {child,done};
    };
    // Authenticate the entire ciphertext before any target write. A downstream restore
    // must not commit bytes from an input whose final authentication fails.
    const verify=launch(config.age,["--decrypt","--identity",config.identityFile]);
    const verification=pipeline(createReadStream(config.archive),verify.child.stdin,{signal:controller.signal});
    verification.catch(stop);
    const verified=await Promise.allSettled([verify.done,verification]);
    if(controller.signal.aborted || verified.some(item=>item.status==="rejected")) throw new Error();
    const recheck=createHash("sha256");
    for await(const chunk of createReadStream(config.archive)) recheck.update(chunk);
    if(recheck.digest("hex")!==config.sha256) throw new Error();
    const identity=JSON.parse(await privatePsql(config,emptyTargetSql));
    if(identity.database!==config.database || identity.role!==config.user || identity.major!==18 || identity.objects!==0 || controller.signal.aborted) throw new Error();
    const decrypt=launch(config.age,["--decrypt","--identity",config.identityFile],false);
    // Decrypted stdout is consumed only by the restore pipe, never a file or log.
    const restore=launch(config.pgRestore,["--single-transaction","--exit-on-error","--no-owner","--dbname",targetConnection(config,false)]);
    const tasks=[decrypt.done,restore.done,
      pipeline(createReadStream(config.archive),decrypt.child.stdin,{signal:controller.signal}),
      pipeline(decrypt.child.stdout,restore.child.stdin,{signal:controller.signal})];
    for(const task of tasks) task.catch(stop);
    const outcomes=await Promise.allSettled(tasks);
    if(controller.signal.aborted || outcomes.some(item=>item.status==="rejected")) throw new Error();
    return {status:"restored",validationRequired:true};
  } catch { stop();throw new Error("Recovery restore failed"); }
  finally {clearTimeout(timer);signal?.removeEventListener("abort",stop);}
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  (async()=>{
    const args=process.argv.slice(2);
    if(args.length<1||args.length>2||!isAbsolute(args[0])||(args[1]&&args[1]!=="--execute-restore")) throw new Error();
    privatePath(args[0]);
    const config=JSON.parse(readFileSync(args[0],"utf8"));
    const controller=new AbortController();const stop=()=>controller.abort();
    process.once("SIGINT",stop);process.once("SIGTERM",stop);
    try { console.log(JSON.stringify(await runRestore(config,{execute:args[1]==="--execute-restore",signal:controller.signal}))); }
    finally{process.removeListener("SIGINT",stop);process.removeListener("SIGTERM",stop);}
  })().catch(()=>{console.error("Recovery restore stopped; no raw error is logged.");process.exitCode=1;});
}
