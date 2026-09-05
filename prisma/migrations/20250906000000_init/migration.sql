-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Board" AS ENUM ('mainboard', 'sme');

-- CreateEnum
CREATE TYPE "Lifecycle" AS ENUM ('upcoming', 'open', 'closed', 'listed');

-- CreateEnum
CREATE TYPE "Registrar" AS ENUM ('kfintech', 'linkintime', 'bigshare', 'mufg');

-- CreateEnum
CREATE TYPE "IPOStatus" AS ENUM ('pending', 'open', 'closed', 'listed', 'withdrawn');

-- CreateTable
CREATE TABLE "Ipo" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "board" "Board" NOT NULL DEFAULT 'mainboard',
    "registrar" "Registrar" NOT NULL DEFAULT 'kfintech',
    "status" "IPOStatus" NOT NULL DEFAULT 'pending',
    "leadManagers" TEXT[],
    "issueSizeCr" DOUBLE PRECISION NOT NULL,
    "priceBandMin" DOUBLE PRECISION NOT NULL,
    "priceBandMax" DOUBLE PRECISION NOT NULL,
    "lotSize" INTEGER NOT NULL,
    "minInvestment" INTEGER NOT NULL,
    "openDate" TIMESTAMP(3) NOT NULL,
    "closeDate" TIMESTAMP(3) NOT NULL,
    "allotmentDate" TIMESTAMP(3),
    "listingDate" TIMESTAMP(3),
    "listingPrice" DOUBLE PRECISION,
    "exchanges" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GmpSnapshot" (
    "id" TEXT NOT NULL,
    "ipoId" TEXT NOT NULL,
    "gmp" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'investorgain',

    CONSTRAINT "GmpSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubSnapshot" (
    "id" TEXT NOT NULL,
    "ipoId" TEXT NOT NULL,
    "qib" DOUBLE PRECISION,
    "nii" DOUBLE PRECISION,
    "retail" DOUBLE PRECISION,
    "total" DOUBLE PRECISION,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "ipoId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'algorithmic',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "deviceId" TEXT,
    "ipoId" TEXT,
    "trigger" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "ipoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ipo_slug_key" ON "Ipo"("slug");

-- CreateIndex
CREATE INDEX "Ipo_slug_idx" ON "Ipo"("slug");

-- CreateIndex
CREATE INDEX "Ipo_status_idx" ON "Ipo"("status");

-- CreateIndex
CREATE INDEX "Ipo_openDate_idx" ON "Ipo"("openDate");

-- CreateIndex
CREATE INDEX "GmpSnapshot_ipoId_date_idx" ON "GmpSnapshot"("ipoId", "date");

-- CreateIndex
CREATE INDEX "GmpSnapshot_ipoId_idx" ON "GmpSnapshot"("ipoId");

-- CreateIndex
CREATE INDEX "SubSnapshot_ipoId_date_idx" ON "SubSnapshot"("ipoId", "date");

-- CreateIndex
CREATE INDEX "SubSnapshot_ipoId_idx" ON "SubSnapshot"("ipoId");

-- CreateIndex
CREATE INDEX "Report_ipoId_idx" ON "Report"("ipoId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Alert_userId_idx" ON "Alert"("userId");

-- CreateIndex
CREATE INDEX "Alert_deviceId_idx" ON "Alert"("deviceId");

-- CreateIndex
CREATE INDEX "Alert_ipoId_idx" ON "Alert"("ipoId");

-- CreateIndex
CREATE INDEX "WatchlistEntry_userId_idx" ON "WatchlistEntry"("userId");

-- CreateIndex
CREATE INDEX "WatchlistEntry_ipoId_idx" ON "WatchlistEntry"("ipoId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistEntry_userId_ipoId_key" ON "WatchlistEntry"("userId", "ipoId");

-- AddForeignKey
ALTER TABLE "GmpSnapshot" ADD CONSTRAINT "GmpSnapshot_ipoId_fkey" FOREIGN KEY ("ipoId") REFERENCES "Ipo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubSnapshot" ADD CONSTRAINT "SubSnapshot_ipoId_fkey" FOREIGN KEY ("ipoId") REFERENCES "Ipo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_ipoId_fkey" FOREIGN KEY ("ipoId") REFERENCES "Ipo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_ipoId_fkey" FOREIGN KEY ("ipoId") REFERENCES "Ipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistEntry" ADD CONSTRAINT "WatchlistEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistEntry" ADD CONSTRAINT "WatchlistEntry_ipoId_fkey" FOREIGN KEY ("ipoId") REFERENCES "Ipo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
