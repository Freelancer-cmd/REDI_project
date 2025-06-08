import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import * as dotenv from "dotenv";

dotenv.config();

interface SchoolData {
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

let schoolData: SchoolData;

const TOTAL_QUESTIONS_PER_EXAM = 30;

try {
    schoolData = JSON.parse(fs.readFileSync('./data/resp_data.json', "utf8"));
} catch (error) {
    console.error("Failed to load school data:", error);
    schoolData = { schools: [] };
}

function erf(x: number): number {
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
}

const examScoresById: Record<string, number[]> = {};
for (const school of schoolData.schools) {
    for (const student of school.students) {
        for (const exam of student.exams) {
            const eid = String(exam.exam_id);
            if (!examScoresById[eid]) {
                examScoresById[eid] = [];
            }
            examScoresById[eid].push(exam.exam_score);
        }
    }
}

const examStats: Record<string, { mean: number; stdDev: number }> = {};
for (const [eid, scores] of Object.entries(examScoresById)) {
    const mean = scores.reduce((sum, val) => sum + val, 0) / scores.length;
    const variance = scores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / scores.length;
    examStats[eid] = { mean, stdDev: Math.sqrt(variance) };
}

const server = new McpServer({
    name: "educational-insights",
    version: "1.0.0",
    description: "Educational data analysis and insights server",

    capabilities: {
        resources: {
            subscribe: true,
            listChanges: true
        },
        logging: {}
    }
});

server.registerTool(
    "analyze-student-performance",
    {
        description: "Analyze individual student performance across domains",
        inputSchema: {
            student_id: z.string().describe("ID of the student to analyze")
        }
    },
    async ({ student_id }: { student_id: string }) => {
        const student = findStudentById(student_id);
        if (!student) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Student ${student_id} not found`
                    }
                ]
            };
        }

        const analysis = analyzeStudentPerformance(student);
        return {
            content: [
                {
                    type: "text",
                    text: analysis
                }
            ]
        };
    }
);


server.registerTool(
    "compare-domain-performance",
    {
        description: "Compare performance across domains (a, b, c) for a specific school",
        inputSchema: {
            school_id: z.string().describe("Required school ID to analyze")
        }
    },
    async ({ school_id }: { school_id: string }) => {
        const analysis = analyzeDomainPerformance(school_id);
        return {
            content: [
                {
                    type: "text",
                    text: analysis
                }
            ]
        };
    }
);

server.registerTool(
    "identify-struggling-students",
    {
        description: "Identify students who are struggling in specific domains within a school",
        inputSchema: {
            school_id: z.string().describe("Required school ID to analyze"),
            domain: z.preprocess(
                (val) => (typeof val === "string" ? val.toLowerCase() : val),
                z.enum(["a", "b", "c"])
            )
            .optional()
            .describe("Specific domain to analyze (a, b, or c, case-insensitive)"),
            threshold: z.number().default(5).describe("Minimum correct items threshold (out of 10)")
        }
    },
    async ({ school_id, domain, threshold = 5 }: { school_id: string; domain?: "a" | "b" | "c"; threshold?: number }) => {
        const analysis = identifyStrugglingStudents(school_id, domain, threshold);
        return {
            content: [
                {
                    type: "text",
                    text: analysis
                }
            ]
        };
    }
);

server.registerTool(
    "get-school-overview",
    {
        description: "Get overview of a specific school and its performance",
        inputSchema: {
            school_id: z.string().describe("Required school ID to analyze")
        }
    },
    async ({ school_id }: { school_id: string }) => {
        const overview = getSchoolOverview(school_id);
        return {
            content: [
                {
                    type: "text",
                    text: overview
                }
            ]
        };
    }
);

server.registerTool(
    "get-exam-percentile",
    {
        description: "Calculate the percentile rank of a student's exam score relative to the global baseline distribution",
        inputSchema: {
            student_id: z.string().describe("ID of the student to analyze"),
            exam_id: z.union([z.string(), z.number()]).describe("ID of the exam to calculate percentile for"),
        }
    },
    async ({ student_id, exam_id }: { student_id: string; exam_id: string | number }) => {
        const student = findStudentById(student_id);
        if (!student) {
            return { content: [{ type: "text", text: `Student ${student_id} not found` }] };
        }
        const examEntry = student.exams.find(e => String(e.exam_id) === String(exam_id));
        if (!examEntry) {
            return { content: [{ type: "text", text: `Exam ${exam_id} not found for student ${student_id}` }] };
        }
        const stats = examStats[String(exam_id)];
        if (!stats) {
            return { content: [{ type: "text", text: `No baseline available for exam ${exam_id}` }] };
        }
        const { mean, stdDev } = stats;
        if (stdDev === 0) {
            return { content: [{ type: "text", text: `All students have identical scores for exam ${exam_id}. Percentile is undefined.` }] };
        }
        const zScore = (examEntry.exam_score - mean) / stdDev;
        const percentile = 0.5 * (1 + erf(zScore / Math.SQRT2));
        const percentileRounded = (percentile * 100).toFixed(1);
        const text = `Student ${student_id} scored ${examEntry.exam_score} on exam ${exam_id}. Global average: ${mean.toFixed(1)}, standard deviation: ${stdDev.toFixed(1)}. This corresponds to approximately the ${percentileRounded}th percentile.`;
        return { content: [{ type: "text", text }] };
    }
);

function findStudentById(studentId: string) {
    for (const school of schoolData.schools) {
        for (const student of school.students) {
            if (student.id === studentId) {
                return { ...student, school_id: school.id };
            }
        }
    }
    return null;
}

function analyzeStudentPerformance(student: any) {
    const { id, exams, school_id } = student;

    if (!exams || exams.length === 0) {
        return `Student ${id} has no exam data available.`;
    }

    let totalA = 0, totalB = 0, totalC = 0;
    let examCount = exams.length;
    let avgScore = 0;

    for (const exam of exams) {
        totalA += Number(exam.items_correct.A);
        totalB += Number(exam.items_correct.B);
        totalC += Number(exam.items_correct.C);
        avgScore += exam.exam_score;
    }

    avgScore /= examCount;
    const avgA = totalA / examCount;
    const avgB = totalB / examCount;
    const avgC = totalC / examCount;

    const totalCorrect = avgA + avgB + avgC;
    const overallPercentage = (totalCorrect / TOTAL_QUESTIONS_PER_EXAM) * 100;

    const percentageA = (avgA / 10) * 100; // Assuming 10 questions per domain
    const percentageB = (avgB / 10) * 100;
    const percentageC = (avgC / 10) * 100;

    let insights = [`Student ${id} (School: ${school_id}) Performance Analysis:`];
    insights.push(`Average Exam Score: ${avgScore.toFixed(1)}`);
    insights.push(`Overall Questions Correct: ${totalCorrect.toFixed(1)}/${TOTAL_QUESTIONS_PER_EXAM} (${overallPercentage.toFixed(1)}%)`);
    insights.push(`\nDomain Performance (avg items correct & percentage):`);
    insights.push(`  Domain A: ${avgA.toFixed(1)}/10 (${percentageA.toFixed(1)}%)`);
    insights.push(`  Domain B: ${avgB.toFixed(1)}/10 (${percentageB.toFixed(1)}%)`);
    insights.push(`  Domain C: ${avgC.toFixed(1)}/10 (${percentageC.toFixed(1)}%)`);

    const weakestDomain = avgA < avgB && avgA < avgC ? 'A' : avgB < avgC ? 'B' : 'C';
    const strongestDomain = avgA > avgB && avgA > avgC ? 'A' : avgB > avgC ? 'B' : 'C';

    insights.push(`\nInsights:`);
    insights.push(`- Strongest domain: ${strongestDomain}`);
    insights.push(`- Weakest domain: ${weakestDomain}`);

    if (percentageA < 50) insights.push(`- Student is struggling in Domain A (${percentageA.toFixed(1)}% - below 50%)`);
    if (percentageB < 50) insights.push(`- Student is struggling in Domain B (${percentageB.toFixed(1)}% - below 50%)`);
    if (percentageC < 50) insights.push(`- Student is struggling in Domain C (${percentageC.toFixed(1)}% - below 50%)`);

    if (overallPercentage < 60) {
        insights.push(`- Student needs significant support (${overallPercentage.toFixed(1)}% overall)`);
    } else if (overallPercentage < 75) {
        insights.push(`- Student could benefit from additional practice (${overallPercentage.toFixed(1)}% overall)`);
    } else {
        insights.push(`- Student is performing well overall (${overallPercentage.toFixed(1)}% overall)`);
    }

    return insights.join('\n');
}

function analyzeDomainPerformance(schoolId: string) {
    const school = schoolData.schools.find(s => s.id === schoolId);

    if (!school) {
        return `School ${schoolId} not found.`;
    }

    if (school.students.length === 0) {
        return `No students found in school ${schoolId}.`;
    }

    let students = school.students.map(s => ({ ...s, school_id: school.id }));

    let domainA = 0, domainB = 0, domainC = 0;
    let studentCount = 0;

    for (const student of students) {
        for (const exam of student.exams) {
            domainA += exam.items_correct.A;
            domainB += exam.items_correct.B;
            domainC += exam.items_correct.C;
            studentCount++;
        }
    }

    const avgA = domainA / studentCount;
    const avgB = domainB / studentCount;
    const avgC = domainC / studentCount;

    const percentageA = (avgA / 10) * 100; // 10 questions per domain
    const percentageB = (avgB / 10) * 100;
    const percentageC = (avgC / 10) * 100;

    let analysis = [`Domain Performance Analysis for School ${schoolId}:`];
    analysis.push(`Total exams analyzed: ${studentCount}`);
    analysis.push(`\nAverage performance per domain (out of 10 questions):`);
    analysis.push(`  Domain A: ${avgA.toFixed(2)} correct (${percentageA.toFixed(1)}%)`);
    analysis.push(`  Domain B: ${avgB.toFixed(2)} correct (${percentageB.toFixed(1)}%)`);
    analysis.push(`  Domain C: ${avgC.toFixed(2)} correct (${percentageC.toFixed(1)}%)`);

    const weakestDomain = avgA < avgB && avgA < avgC ? 'A' : avgB < avgC ? 'B' : 'C';
    const strongestDomain = avgA > avgB && avgA > avgC ? 'A' : avgB > avgC ? 'B' : 'C';

    analysis.push(`\nSchool ${schoolId} strongest domain: ${strongestDomain}`);
    analysis.push(`School ${schoolId} weakest domain: ${weakestDomain}`);

    if (percentageA < 60) analysis.push(`- Domain A needs attention (${percentageA.toFixed(1)}% average)`);
    if (percentageB < 60) analysis.push(`- Domain B needs attention (${percentageB.toFixed(1)}% average)`);
    if (percentageC < 60) analysis.push(`- Domain C needs attention (${percentageC.toFixed(1)}% average)`);

    return analysis.join('\n');
}

function identifyStrugglingStudents(schoolId: string, domain?: "a" | "b" | "c", threshold: number = 5) {
    const school = schoolData.schools.find(s => s.id === schoolId);

    if (!school) {
        return `School ${schoolId} not found.`;
    }

    let strugglingStudents = [];

    for (const student of school.students) {
        for (const exam of student.exams) {
            if (domain) {
                const domainKey = domain.toUpperCase() as 'A' | 'B' | 'C';
                if (exam.items_correct[domainKey] < threshold) {
                    const percentage = (exam.items_correct[domainKey] / 10) * 100;
                    strugglingStudents.push({
                        student_id: student.id,
                        school_id: school.id,
                        domain,
                        score: exam.items_correct[domainKey],
                        percentage: percentage,
                        exam_id: exam.exam_id
                    });
                }
            } else {
                if (exam.items_correct.A < threshold) {
                    const percentage = (exam.items_correct.A / 10) * 100;
                    strugglingStudents.push({
                        student_id: student.id,
                        school_id: school.id,
                        domain: 'a',
                        score: exam.items_correct.A,
                        percentage: percentage,
                        exam_id: exam.exam_id
                    });
                }
                if (exam.items_correct.B < threshold) {
                    const percentage = (exam.items_correct.B / 10) * 100;
                    strugglingStudents.push({
                        student_id: student.id,
                        school_id: school.id,
                        domain: 'b',
                        score: exam.items_correct.B,
                        percentage: percentage,
                        exam_id: exam.exam_id
                    });
                }
                if (exam.items_correct.C < threshold) {
                    const percentage = (exam.items_correct.C / 10) * 100;
                    strugglingStudents.push({
                        student_id: student.id,
                        school_id: school.id,
                        domain: 'c',
                        score: exam.items_correct.C,
                        percentage: percentage,
                        exam_id: exam.exam_id
                    });
                }
            }
        }
    }

    if (strugglingStudents.length === 0) {
        return `No students found struggling in School ${schoolId}${domain ? ` in domain ${domain.toUpperCase()}` : ''} with threshold ${threshold}/10 (${(threshold/10*100)}%).`;
    }

    let analysis = [`Students Struggling in School ${schoolId}${domain ? ` in Domain ${domain.toUpperCase()}` : ''} (below ${threshold}/10 questions or ${(threshold/10*100)}%):`];

    for (const student of strugglingStudents) {
        analysis.push(`- Student ${student.student_id}: Domain ${student.domain.toUpperCase()} ${student.score}/10 (${student.percentage.toFixed(1)}%) in ${student.exam_id}`);
    }

    return analysis.join('\n');
}

function getSchoolOverview(schoolId: string) {
    const school = schoolData.schools.find(s => s.id === schoolId);

    if (!school) {
        return `School ${schoolId} not found.`;
    }

    let overview = [`School ${school.id} Overview:\n`];
    overview.push(`Students: ${school.students.length}`);

    let totalScore = 0;
    let totalExams = 0;
    let totalA = 0, totalB = 0, totalC = 0;

    for (const student of school.students) {
        for (const exam of student.exams) {
            totalScore += exam.exam_score;
            totalA += exam.items_correct.A;
            totalB += exam.items_correct.B;
            totalC += exam.items_correct.C;
            totalExams++;
        }
    }

    if (totalExams > 0) {
        const avgScore = (totalScore / totalExams).toFixed(1);
        const avgA = (totalA / totalExams).toFixed(1);
        const avgB = (totalB / totalExams).toFixed(1);
        const avgC = (totalC / totalExams).toFixed(1);

        overview.push(`Total Exams: ${totalExams}`);
        overview.push(`Average Exam Score: ${avgScore}`);
        overview.push(`\nAverage Domain Performance:`);
        overview.push(`  Domain A: ${avgA}/10 (${((totalA/totalExams)/10*100).toFixed(1)}%)`);
        overview.push(`  Domain B: ${avgB}/10 (${((totalB/totalExams)/10*100).toFixed(1)}%)`);
        overview.push(`  Domain C: ${avgC}/10 (${((totalC/totalExams)/10*100).toFixed(1)}%)`);
    } else {
        overview.push(`No exam data available for school ${schoolId}`);
    }

    return overview.join('\n');
}

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("MCP Server is running.");
}

main().catch(console.error);