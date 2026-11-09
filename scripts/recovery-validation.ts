import { PgDialect } from "drizzle-orm/pg-core";
import { INVARIANT_CHECKS } from "../lib/invariants";

/** SQL only: no database import, credentials or row output. */
export function buildRecoveryValidationSql(): string {
  const dialect = new PgDialect();
  const checks = INVARIANT_CHECKS.map((check) => {
    const compiled = dialect.sqlToQuery(check.query);
    if (compiled.params.length || !/^[a-z_]+$/.test(check.name)) throw new Error("Unsupported invariant SQL");
    return `SELECT json_build_object('kind','invariant','name','${check.name}','violations',count(*)) FROM (${compiled.sql}) AS violations;`;
  });
  return `BEGIN READ ONLY;
SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '5s';
SET LOCAL timezone = 'UTC';
SET LOCAL datestyle = 'ISO, YMD';
SET LOCAL search_path = public, pg_catalog;
SELECT json_build_object('kind','identity','database',current_database(),'role',current_user,'major',current_setting('server_version_num')::int / 10000);
SELECT json_build_object('kind','catalog','sha256',encode(sha256(convert_to(jsonb_build_object(
 'columns',(SELECT jsonb_agg(to_jsonb(c)-'ordinal_position'-'dtd_identifier' ORDER BY c.table_schema,c.table_name,c.ordinal_position) FROM information_schema.columns c WHERE c.table_schema='public'),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.conrelid::regclass::text,c.conname,pg_get_constraintdef(c.oid),c.convalidated) ORDER BY c.conrelid::regclass::text,c.conname) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public'),
 'indexes',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.tablename,i.indexname) FROM pg_indexes i WHERE i.schemaname='public'),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(c.relname,t.tgname,pg_get_triggerdef(t.oid),t.tgenabled) ORDER BY c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal),
 'functions',(SELECT jsonb_agg(jsonb_build_array(pg_get_functiondef(p.oid),pg_get_userbyid(p.proowner),p.proacl::text) ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p')),
 'enums',(SELECT jsonb_agg(jsonb_build_array(t.typname,e.enumlabel,e.enumsortorder) ORDER BY t.typname,e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'),
 'owners',(SELECT jsonb_agg(jsonb_build_array(c.relname,pg_get_userbyid(c.relowner),c.relrowsecurity,c.relforcerowsecurity) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
 'grants',(SELECT jsonb_agg(to_jsonb(g) ORDER BY g.table_name,g.grantee,g.privilege_type,g.grantor) FROM information_schema.role_table_grants g WHERE g.table_schema='public'),
 'column_grants',(SELECT jsonb_agg(to_jsonb(g) ORDER BY g.table_name,g.column_name,g.grantee,g.privilege_type,g.grantor) FROM information_schema.role_column_grants g WHERE g.table_schema='public'),
 'schema_acl',(SELECT jsonb_build_array(pg_get_userbyid(n.nspowner),n.nspacl::text) FROM pg_namespace n WHERE n.nspname='public'),
 'views',(SELECT jsonb_agg(to_jsonb(v) ORDER BY v.viewname) FROM pg_views v WHERE v.schemaname='public'),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.tablename,p.policyname) FROM pg_policies p WHERE p.schemaname='public'),
 'extensions',(SELECT jsonb_agg(jsonb_build_array(extname,extversion) ORDER BY extname) FROM pg_extension),
 'sequence_definitions',(SELECT jsonb_agg(to_jsonb(s)-'last_value' ORDER BY s.sequencename) FROM pg_sequences s WHERE s.schemaname='public')
)::text,'UTF8')),'hex'));
SELECT json_build_object('kind','privileges','schema_create',has_schema_privilege(current_user,'public','CREATE'),'schema_usage',has_schema_privilege(current_user,'public','USAGE'),'db_create',has_database_privilege(current_user,current_database(),'CREATE'),'role_flags',(SELECT json_build_array(rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls) FROM pg_roles WHERE rolname=current_user));
-- Dynamic statements use server-side identifier quoting. Only aggregates leave the server.
SELECT format('SELECT json_build_object(''kind'',''table'',''name'',%L,''count'',count(*),''sha256'',encode(sha256(convert_to(coalesce(string_agg(h, '''' ORDER BY h),''''),''UTF8'')),''hex'')) FROM (SELECT encode(sha256(convert_to(to_jsonb(t)::text,''UTF8'')),''hex'') AS h FROM %I.%I t) hashed;',c.relname,n.nspname,c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname
\\gexec
SELECT format('SELECT json_build_object(''kind'',''sequence'',''name'',%L,''last_value'',last_value,''is_called'',is_called) FROM %I.%I;',c.relname,n.nspname,c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='S' ORDER BY c.relname
\\gexec
${checks.join("\n")}
COMMIT;
`;
}

export function compareRecoveryReports(source: Record<string, unknown>[], target: Record<string, unknown>[]): void {
  for (const report of [source, target]) {
    const invariants = report.filter((item) => item.kind === "invariant");
    if (JSON.stringify(invariants.map((item) => item.name).sort()) !== JSON.stringify(INVARIANT_CHECKS.map((item) => item.name).sort()) || invariants.some((item) => item.violations !== 0) ||
        !report.some((item) => item.kind === "catalog") || !report.some((item) => item.kind === "table" && item.name === "_migrations")) {
      throw new Error("Recovery validation failed");
    }
  }
  const normalize = (report: Record<string, unknown>[]) => JSON.stringify([...report].sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
  if (normalize(source) !== normalize(target)) throw new Error("Recovery validation differs");
}
