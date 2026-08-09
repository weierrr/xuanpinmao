-- Phase 2A-R non-business migration used to verify migration history behavior.
CREATE TABLE "MigrationSmoke" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "note" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
