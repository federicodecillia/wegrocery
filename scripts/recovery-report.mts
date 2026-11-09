// Explicit, read-only aggregate report. Never imports the application DB client.
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { privatePath, validateManifest } from "./recovery-backup.mjs";
import { privatePsql } from "./recovery-restore.mjs";
import { buildRecoveryValidationSql, compareRecoveryReports } from "./recovery-validation";

try {
  const args=process.argv.slice(2);
  if(args[0]==="--compare" && args.length===3) {
    privatePath(args[1]); privatePath(args[2]);
    compareRecoveryReports(JSON.parse(readFileSync(args[1],"utf8")),JSON.parse(readFileSync(args[2],"utf8")));
    console.log(JSON.stringify({status:"matched",invariants:"zero violations"}));
  } else {
    if(args.length<1||args.length>2||(args[1]&&args[1]!=="--execute-report")) throw new Error();
    privatePath(args[0]);
    const config=validateManifest(JSON.parse(readFileSync(args[0],"utf8")));
    if(args[1]!=="--execute-report") console.log(JSON.stringify({status:"planned",databaseContacted:false}));
    else {
      privatePath(config.serviceFile);privatePath(config.passwordFile);privatePath(config.outputDirectory,true);
      const output=await privatePsql({...config,psql:join(dirname(config.pgDump),"psql"),targetHost:config.sourceHost},buildRecoveryValidationSql());
      const report=String(output).trim().split("\n").map((line)=>JSON.parse(line));
      const identity=report.find((item)=>item.kind==="identity");
      if(identity?.database!==config.database||identity?.role!==config.user||identity?.major!==18) throw new Error();
      // Requires the complete invariant set and migration ledger even for a single report.
      compareRecoveryReports(report,report);
      const name=`validation-${randomUUID()}.json`;
      writeFileSync(join(config.outputDirectory,name),JSON.stringify(report),{mode:0o600,flag:"wx"});
      console.log(JSON.stringify({status:"reported",artifact:name,invariants:"zero violations"}));
    }
  }
} catch {
  console.error("Recovery validation stopped; no row, identifier or raw error is logged.");
  process.exitCode=1;
}
