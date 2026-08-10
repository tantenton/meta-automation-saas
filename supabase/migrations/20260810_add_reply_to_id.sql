-- Add reply_to_id column to posts table for Threads reply support
alter table posts add column if not exists reply_to_id text;
