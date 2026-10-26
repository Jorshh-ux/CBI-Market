ALTER TABLE "StoreSettings" ADD COLUMN "welcomeMessage" TEXT NOT NULL DEFAULT 'Responde unas preguntas para descubrir qué producto se adapta mejor a tus necesidades.';
ALTER TABLE "StoreSettings" ADD COLUMN "outOfStockBehavior" TEXT NOT NULL DEFAULT 'EXCLUDE';
ALTER TABLE "StoreSettings" ADD COLUMN "respectBudget" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StoreSettings" ADD COLUMN "prioritizeAvailability" BOOLEAN NOT NULL DEFAULT true;
