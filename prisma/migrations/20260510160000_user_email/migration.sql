-- Rename legacy username column to email (signup/login use email + password)
ALTER TABLE "User" RENAME COLUMN "username" TO "email";

ALTER INDEX "User_username_key" RENAME TO "User_email_key";
