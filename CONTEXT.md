# Radius Glossary

## Project

A filesystem directory that contains AI coding sessions. Identified by its
normalized absolute path (used as primary key). The display name is derived
from the directory basename.

Used to group sessions from both Pi and Opencode that were started in the same
working directory.

## Session

A single conversation thread between a user and an AI agent. Belongs to
exactly one Project. Has a unique ID assigned by the source system (Pi UUIDv7
or Opencode ses_xxx). Can have a parent session (forking).

The session row stores only metadata (agent type, timestamps) — the
actual conversation data lives in Events.

The display `title` is derived at ingest time: latest explicit name
(`session_info` for Pi, `title` column for Opencode), or first ~80 chars
of the first user message.

## Event

The primary unit of conversation: a message exchange between user and AI
agent. Contains role, content blocks (text, tool calls, reasoning), model,
provider, usage, stop reason. One event = one message.

Belongs to exactly one Session. Has a 0-based sequence number within that
session. May have a parent event (for Pi's tree-structure branching).

## Session Event

Session-level metadata mutations: model changes, thinking level changes,
compaction records, branch summaries, labels, session info updates, custom
events. Not conversation data — auxiliary signals for deeper analysis.

Has the same id/session_id/time_created/data structure as Event but no
seq or parent_id.

## Session Summary

A materialised, pre-computed rollup of one session's event stream.
Contains duration, message/user/assistant counts, tool call/error counts,
total tokens, total cost, models used (as JSON array), and stop reasons
(as JSON map). Computed during ingestion and upserted on re-ingest.

Not a primary domain entity — a derived view optimised for dashboard
aggregations.

## Swear Entry

A materialised occurrence of a swear word found in a user message during
ingestion. Captures the word, surrounding context snippet, linked session
and project. Computed once at ingest time and never refreshed.

Not a primary domain entity — an analytics artifact produced by a
best-effort scan during import.
