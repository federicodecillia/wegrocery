-- Guide searches with no results, counted without saying who searched:
-- admin → Impostazioni lists them so the group can add what members look for
-- and do not find (in "Il nostro gruppo" or a new guide card).
--
-- guide_search_misses.query     the words searched, normalized (lower case,
--                               no accents) by lib/guide/search-misses.ts,
--                               which drops anything that looks personal
--                               (an address, a long number, a sentence).
-- guide_search_misses.count     how many times.
-- guide_search_misses.last_at   the latest; rows older than 90 days are
--                               removed when a new miss is recorded.
--
-- No member id, by design. APPLY BEFORE DEPLOYING the code that ships with
-- it. Additive, idempotent.

CREATE TABLE IF NOT EXISTS guide_search_misses (
  query text PRIMARY KEY,
  count integer NOT NULL DEFAULT 1,
  last_at timestamptz NOT NULL,
  CONSTRAINT guide_search_misses_query_length CHECK (char_length(query) BETWEEN 3 AND 60)
);
