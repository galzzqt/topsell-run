-- Migration: Add Email Verification Fields to Families
-- Date: 2026-06-23
-- Purpose: Add email verification functionality for Brother & Sister Package registration

-- Add email verification fields to families collection
-- Run this in MongoDB shell or via MongoDB Compass

db.families.updateMany(
  {},
  {
    $set: {
      email_verified: false,
      verification_token: null,
      verification_token_expires: null,
      verification_sent_at: null
    }
  }
);

-- Create index on verification_token for faster lookups
db.families.createIndex({ verification_token: 1 });

-- Verify the migration
db.families.findOne({}, {
  email_verified: 1,
  verification_token: 1,
  verification_token_expires: 1,
  verification_sent_at: 1
});
