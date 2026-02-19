import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import {
  calculateStudyLogUpdate,
  simulateStudyLogAfterRatings,
  StudyLogRecord,
} from '../lib/study-log';

/**
 * Study Log Property-Based Tests
 * 
 * These tests verify the correctness properties of the study log upsert system
 * as specified in the design document.
 */

// Generator for valid user IDs (UUID format)
const userIdArb = fc.uuid();

// Generator for valid study dates (YYYY-MM-DD format)
const studyDateArb = fc.integer({
  min: new Date('2020-01-01').getTime(),
  max: new Date('2030-12-31').getTime(),
}).map(timestamp => new Date(timestamp).toISOString().split('T')[0]);

// Generator for valid cards_reviewed counts
const cardsReviewedArb = fc.integer({ min: 0, max: 10000 });

// Generator for number of ratings in a session
const numRatingsArb = fc.integer({ min: 1, max: 100 });

// Generator for existing study log record
const existingLogArb = fc.record({
  user_id: userIdArb,
  study_date: studyDateArb,
  cards_reviewed: cardsReviewedArb,
});

/**
 * **Feature: cekatan, Property 4: Study Log Upsert Correctness**
 * **Validates: Requirements 2.1, 9.1, 9.4**
 * 
 * For any user and for any date, after N card ratings on that date,
 * there SHALL be exactly one study_log record with `cards_reviewed` equal to N.
 */
describe('Property 4: Study Log Upsert Correctness', () => {
  test('After N ratings, cards_reviewed equals N', () => {
    fc.assert(
      fc.property(userIdArb, studyDateArb, numRatingsArb, (userId, studyDate, numRatings) => {
        const result = simulateStudyLogAfterRatings(userId, studyDate, numRatings);
        
        // After N ratings, cards_reviewed should equal N
        expect(result.cardsReviewed).toBe(numRatings);
        // User ID should be preserved
        expect(result.userId).toBe(userId);
        // Study date should be preserved
        expect(result.studyDate).toBe(studyDate);
      }),
      { numRuns: 100 }
    );
  });

  test('Single rating on new date creates record with count 1', () => {
    fc.assert(
      fc.property(userIdArb, studyDateArb, (userId, studyDate) => {
        const result = calculateStudyLogUpdate(null, userId, studyDate);
        
        expect(result.cardsReviewed).toBe(1);
        expect(result.userId).toBe(userId);
        expect(result.studyDate).toBe(studyDate);
      }),
      { numRuns: 100 }
    );
  });

  test('Rating on existing date increments count by 1', () => {
    fc.assert(
      fc.property(existingLogArb, (existingLog) => {
        const result = calculateStudyLogUpdate(
          existingLog,
          existingLog.user_id,
          existingLog.study_date
        );
        
        expect(result.cardsReviewed).toBe(existingLog.cards_reviewed + 1);
        expect(result.userId).toBe(existingLog.user_id);
        expect(result.studyDate).toBe(existingLog.study_date);
      }),
      { numRuns: 100 }
    );
  });

  test('Multiple ratings accumulate correctly (idempotent increment)', () => {
    fc.assert(
      fc.property(
        userIdArb,
        studyDateArb,
        fc.array(fc.constant(1), { minLength: 1, maxLength: 50 }),
        (userId, studyDate, ratings) => {
          let currentLog: StudyLogRecord | null = null;
          
          for (const _ of ratings) {
            const newState = calculateStudyLogUpdate(currentLog, userId, studyDate);
            currentLog = {
              user_id: newState.userId,
              study_date: newState.studyDate,
              cards_reviewed: newState.cardsReviewed,
            };
          }
          
          // After N ratings, count should be N
          expect(currentLog!.cards_reviewed).toBe(ratings.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Cards reviewed count never decreases', () => {
    fc.assert(
      fc.property(existingLogArb, (existingLog) => {
        const result = calculateStudyLogUpdate(
          existingLog,
          existingLog.user_id,
          existingLog.study_date
        );
        
        expect(result.cardsReviewed).toBeGreaterThan(existingLog.cards_reviewed);
      }),
      { numRuns: 100 }
    );
  });

  test('Zero ratings results in zero cards reviewed', () => {
    fc.assert(
      fc.property(userIdArb, studyDateArb, (userId, studyDate) => {
        const result = simulateStudyLogAfterRatings(userId, studyDate, 0);
        
        expect(result.cardsReviewed).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  test('Unique constraint simulation - same user/date always updates same record', () => {
    fc.assert(
      fc.property(
        userIdArb,
        studyDateArb,
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 20 }),
        (userId, studyDate, firstBatch, secondBatch) => {
          // Simulate first batch of ratings
          const afterFirstBatch = simulateStudyLogAfterRatings(userId, studyDate, firstBatch);
          
          // Continue with second batch (simulating upsert behavior)
          let currentLog: StudyLogRecord = {
            user_id: afterFirstBatch.userId,
            study_date: afterFirstBatch.studyDate,
            cards_reviewed: afterFirstBatch.cardsReviewed,
          };
          
          for (let i = 0; i < secondBatch; i++) {
            const newState = calculateStudyLogUpdate(currentLog, userId, studyDate);
            currentLog = {
              user_id: newState.userId,
              study_date: newState.studyDate,
              cards_reviewed: newState.cardsReviewed,
            };
          }
          
          // Total should be sum of both batches
          expect(currentLog.cards_reviewed).toBe(firstBatch + secondBatch);
        }
      ),
      { numRuns: 100 }
    );
  });
});
