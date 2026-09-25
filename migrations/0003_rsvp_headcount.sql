-- RSVP headcount breakdown: Adults + Kids.
--
-- Guests previously submitted ONE generic count (`attendees`). The invitation now
-- asks for Adults and Kids separately, with the total derived as adults + kids.
--
-- Backward compatibility (this file is additive and safe to re-run):
--   * `attendees` is deliberately KEPT, not dropped. It is the only headcount the
--     pre-feature rows have, and dropping it would destroy that history. New
--     writes keep it in sync as `adults + kids`, so it stays a valid total.
--   * Existing rows are backfilled with the agreed legacy fallback:
--       adults = attendees, kids = 0
--     applied ONLY where the new columns are still untouched, so a host's later
--     edit is never overwritten if this migration is re-applied.
--
-- Nothing here can fail on a database that already has the columns.

alter table rsvps add column if not exists adults integer not null default 0;
alter table rsvps add column if not exists kids integer not null default 0;

-- Legacy backfill: a pre-feature reply of N attendees becomes N adults, 0 kids.
update rsvps
   set adults = attendees,
       kids = 0
 where adults = 0
   and kids = 0
   and attendees > 0;

-- The old single-count rule no longer applies to the new split columns.
alter table rsvps drop constraint if exists rsvps_attendees_check;

-- Headcounts can never be negative (mirrors the guests-side stepper floor).
alter table rsvps drop constraint if exists rsvps_headcount_check;
alter table rsvps
  add constraint rsvps_headcount_check check (adults >= 0 and kids >= 0);
