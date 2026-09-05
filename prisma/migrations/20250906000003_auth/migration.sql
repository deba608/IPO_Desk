-- Auth.js v5 account links, optional user phone, passwordless admin OTP challenges.
CREATE TABLE "Account" (
  "id"                TEXT NOT NULL,
  "userId"            TEXT NOT NULL,
  "type"              TEXT NOT NULL,
  "provider"          TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "refresh_token"     TEXT,
  "access_token"      TEXT,
  "expires_at"        INTEGER,
  "token_type"        TEXT,
  "scope"             TEXT,
  "id_token"          TEXT,
  "session_state"     TEXT,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User" ADD COLUMN "phone" TEXT;

CREATE TABLE "AdminOtpChallenge" (
  "id"             TEXT NOT NULL,
  "identifierHash" TEXT NOT NULL,
  "codeHash"       TEXT NOT NULL,
  "attempts"       INTEGER NOT NULL DEFAULT 0,
  "resendAfter"    TIMESTAMP(3) NOT NULL,
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminOtpChallenge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminOtpChallenge_identifierHash_key" ON "AdminOtpChallenge"("identifierHash");
