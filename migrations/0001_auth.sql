-- Better Auth schema (identity + sessions), SQLite dialect for Cloudflare D1.
--
-- Matches what the Better Auth CLI emits for a SQLite provider: camelCase
-- columns (kept double-quoted so the case is unambiguous), booleans as INTEGER
-- and timestamps as TEXT. The adapter reports `supportsBooleans: false` and
-- `supportsDates: false` for SQLite, so it converts both itself on the way in
-- and out — the columns only have to hold the encoded form.
--
-- Magic-link sign-in needs no table of its own: the token lives in
-- `verification` alongside every other short-lived credential.
--
-- Put YOUR app's schema in NEW ordered files (0002_*.sql, …), never in this one.

create table if not exists "user" (
  "id" text not null primary key,
  "name" text not null,
  "email" text not null unique,
  "emailVerified" integer not null default 0,
  "image" text,
  "createdAt" text not null,
  "updatedAt" text not null
);

create table if not exists "session" (
  "id" text not null primary key,
  "expiresAt" text not null,
  "token" text not null unique,
  "createdAt" text not null,
  "updatedAt" text not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user" ("id") on delete cascade
);

create index if not exists "session_userId_idx" on "session" ("userId");

create table if not exists "account" (
  "id" text not null primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user" ("id") on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" text,
  "refreshTokenExpiresAt" text,
  "scope" text,
  "password" text,
  "createdAt" text not null,
  "updatedAt" text not null
);

create index if not exists "account_userId_idx" on "account" ("userId");

create table if not exists "verification" (
  "id" text not null primary key,
  "identifier" text not null,
  "value" text not null,
  "expiresAt" text not null,
  "createdAt" text not null,
  "updatedAt" text not null
);

create index if not exists "verification_identifier_idx"
  on "verification" ("identifier");
