-- UserCredential: per-user encrypted login credentials for ATS / job-board
-- sites. password column stores `iv || authTag || ciphertext` produced by
-- AES-256-GCM in lib/credentials/cipher.ts. Encryption key is server-side
-- env (`CREDENTIAL_ENCRYPTION_KEY`), so a DB dump alone cannot yield
-- plaintext.

CREATE TABLE "UserCredential" (
  "id"        TEXT        NOT NULL,
  "userId"    TEXT        NOT NULL,
  "hostname"  TEXT        NOT NULL,
  "label"     TEXT,
  "username"  TEXT        NOT NULL,
  "password"  BYTEA       NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserCredential_userId_hostname_username_key"
  ON "UserCredential"("userId", "hostname", "username");

CREATE INDEX "UserCredential_userId_hostname_idx"
  ON "UserCredential"("userId", "hostname");

ALTER TABLE "UserCredential"
  ADD CONSTRAINT "UserCredential_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
