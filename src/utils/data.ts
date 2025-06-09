/**
 * Utility module for loading and providing access to school data
 * and computing global exam baseline statistics (mean & stdDev).
 */

import fs from "fs";
import * as dotenv from "dotenv";

// Load environment variables (e.g., OPENAI_API_KEY)
dotenv.config();

/** Raw structure of the JSON data file */
export interface SchoolData {
  schools: {
    id: string;
    students: {
      id: string;
      key: string;
      exams: {
        exam_id: string;
        exam_score: number;
        time: string;
        items_correct: {
          A: number;
          B: number;
          C: number;
        };
      }[];
    }[];
  }[];
}

/**
 * Load the response data file (data/resp_data.json).
 * If loading fails, an empty dataset is used.
 */
export const schoolData: SchoolData = (() => {
  try {
    const raw = fs.readFileSync("./data/resp_data.json", "utf8");
    return JSON.parse(raw) as SchoolData;
  } catch (err) {
    console.error("Failed to load school data:", err);
    return { schools: [] };
  }
})();

/** Total number of questions per exam across all domains */
export const TOTAL_QUESTIONS_PER_EXAM = 30;

/**
 * Lookup a student by ID across all schools.
 * Returns the student (with added school_id) or null if not found.
 */
export function findStudentById(studentId: string) {
  for (const school of schoolData.schools) {
    for (const student of school.students) {
      if (student.id === studentId) {
        return { ...student, school_id: school.id };
      }
    }
  }
  return null;
}

/**
 * Lookup a school by ID.
 * Returns the school or null if not found.
 */
export function findSchoolById(schoolId: string) {
  return schoolData.schools.find((s) => s.id === schoolId) || null;
}

/**
 * Pre-compute baseline exam score distributions (mean & stdDev)
 * for each exam across all students, assuming a normal distribution.
 */
export const examStats: Record<string, { mean: number; stdDev: number }> = (() => {
  const scoresByExam: Record<string, number[]> = {};
  for (const school of schoolData.schools) {
    for (const student of school.students) {
      for (const exam of student.exams) {
        const key = String(exam.exam_id);
        (scoresByExam[key] ||= []).push(exam.exam_score);
      }
    }
  }
  const stats: Record<string, { mean: number; stdDev: number }> = {};
  for (const [examId, scores] of Object.entries(scoresByExam)) {
    const mean = scores.reduce((sum, v) => sum + v, 0) / scores.length;
    const variance = scores.reduce((sum, v) => sum + (v - mean) ** 2, 0) / scores.length;
    stats[examId] = { mean, stdDev: Math.sqrt(variance) };
  }
  return stats;
})();


/**
 * Abbreviate a list of IDs by keeping the first and last items with an ellipsis in between when truncated.
 *
 * @param ids - The array of string IDs to abbreviate.
 * @param count - Number of items to retain at the start and end of the list (default is 5).
 * @returns A new array of IDs, possibly containing '...' to indicate omitted entries.
 */
export function abbreviateIds(ids: string[], count: number = 5): string[] {
  if (ids.length <= count * 2) {
    return ids;
  }
  return [...ids.slice(0, count), "...", ...ids.slice(-count)];
}