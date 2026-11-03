-- Seminar kinds become two: 세미나 (seminar, heard) and 발표 (talk, given).
-- 학회 발표 → 발표; 강의·웨비나·기타 → 세미나. Data only: kind is a plain text column.
UPDATE `seminars` SET `kind` = 'talk' WHERE `kind` = 'conference_talk';
--> statement-breakpoint
UPDATE `seminars` SET `kind` = 'seminar' WHERE `kind` NOT IN ('seminar', 'talk');
