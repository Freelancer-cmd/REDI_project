"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const sse_js_1 = require("@modelcontextprotocol/sdk/server/sse.js");
const zod_1 = require("zod");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
let schoolData;
const TOTAL_QUESTIONS_PER_EXAM = 30;
try {
    const dataPath = path_1.default.join(__dirname, "../data/resp_data.json");
    schoolData = JSON.parse(fs_1.default.readFileSync(dataPath, "utf8"));
}
catch (error) {
    console.error("Failed to load school data:", error);
    schoolData = { schools: [] };
}
const server = new mcp_js_1.McpServer({
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
server.registerTool("analyze-student-performance", {
    description: "Analyze individual student performance across domains",
    inputSchema: zod_1.z.object({
        student_id: zod_1.z.string().describe("ID of the student to analyze")
    }).shape
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ student_id }) {
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
}));
server.registerTool("compare-domain-performance", {
    description: "Compare performance across domains (a, b, c) for a specific school",
    inputSchema: zod_1.z.object({
        school_id: zod_1.z.string().describe("Required school ID to analyze")
    }).shape
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ school_id }) {
    const analysis = analyzeDomainPerformance(school_id);
    return {
        content: [
            {
                type: "text",
                text: analysis
            }
        ]
    };
}));
server.registerTool("identify-struggling-students", {
    description: "Identify students who are struggling in specific domains within a school",
    inputSchema: zod_1.z.object({
        school_id: zod_1.z.string().describe("Required school ID to analyze"),
        domain: zod_1.z.enum(["a", "b", "c"]).optional().describe("Specific domain to analyze"),
        threshold: zod_1.z.number().default(5).describe("Minimum correct items threshold (out of 10)")
    }).shape
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ school_id, domain, threshold = 5 }) {
    const analysis = identifyStrugglingStudents(school_id, domain, threshold);
    return {
        content: [
            {
                type: "text",
                text: analysis
            }
        ]
    };
}));
server.registerTool("get-school-overview", {
    description: "Get overview of a specific school and its performance",
    inputSchema: zod_1.z.object({
        school_id: zod_1.z.string().describe("Required school ID to analyze")
    }).shape
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ school_id }) {
    const overview = getSchoolOverview(school_id);
    return {
        content: [
            {
                type: "text",
                text: overview
            }
        ]
    };
}));
function findStudentById(studentId) {
    for (const school of schoolData.schools) {
        for (const student of school.students) {
            if (student.id === studentId) {
                return Object.assign(Object.assign({}, student), { school_id: school.id });
            }
        }
    }
    return null;
}
function analyzeStudentPerformance(student) {
    const { id, exams, school_id } = student;
    if (!exams || exams.length === 0) {
        return `Student ${id} has no exam data available.`;
    }
    let totalA = 0, totalB = 0, totalC = 0;
    let examCount = exams.length;
    let avgScore = 0;
    for (const exam of exams) {
        totalA += exam.items_correct.a;
        totalB += exam.items_correct.b;
        totalC += exam.items_correct.c;
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
    insights.push(`Average Exam Score: ${avgScore.toFixed(1)}%`);
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
    if (percentageA < 50)
        insights.push(`- Student is struggling in Domain A (${percentageA.toFixed(1)}% - below 50%)`);
    if (percentageB < 50)
        insights.push(`- Student is struggling in Domain B (${percentageB.toFixed(1)}% - below 50%)`);
    if (percentageC < 50)
        insights.push(`- Student is struggling in Domain C (${percentageC.toFixed(1)}% - below 50%)`);
    if (overallPercentage < 60) {
        insights.push(`- Student needs significant support (${overallPercentage.toFixed(1)}% overall)`);
    }
    else if (overallPercentage < 75) {
        insights.push(`- Student could benefit from additional practice (${overallPercentage.toFixed(1)}% overall)`);
    }
    else {
        insights.push(`- Student is performing well overall (${overallPercentage.toFixed(1)}% overall)`);
    }
    return insights.join('\n');
}
function analyzeDomainPerformance(schoolId) {
    const school = schoolData.schools.find(s => s.id === schoolId);
    if (!school) {
        return `School ${schoolId} not found.`;
    }
    if (school.students.length === 0) {
        return `No students found in school ${schoolId}.`;
    }
    let students = school.students.map(s => (Object.assign(Object.assign({}, s), { school_id: school.id })));
    let domainA = 0, domainB = 0, domainC = 0;
    let studentCount = 0;
    for (const student of students) {
        for (const exam of student.exams) {
            domainA += exam.items_correct.a;
            domainB += exam.items_correct.b;
            domainC += exam.items_correct.c;
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
    if (percentageA < 60)
        analysis.push(`- Domain A needs attention (${percentageA.toFixed(1)}% average)`);
    if (percentageB < 60)
        analysis.push(`- Domain B needs attention (${percentageB.toFixed(1)}% average)`);
    if (percentageC < 60)
        analysis.push(`- Domain C needs attention (${percentageC.toFixed(1)}% average)`);
    return analysis.join('\n');
}
function identifyStrugglingStudents(schoolId, domain, threshold = 5) {
    const school = schoolData.schools.find(s => s.id === schoolId);
    if (!school) {
        return `School ${schoolId} not found.`;
    }
    let strugglingStudents = [];
    for (const student of school.students) {
        for (const exam of student.exams) {
            if (domain) {
                if (exam.items_correct[domain] < threshold) {
                    const percentage = (exam.items_correct[domain] / 10) * 100;
                    strugglingStudents.push({
                        student_id: student.id,
                        school_id: school.id,
                        domain,
                        score: exam.items_correct[domain],
                        percentage: percentage,
                        exam_id: exam.exam_id
                    });
                }
            }
            else {
                if (exam.items_correct.a < threshold) {
                    const percentage = (exam.items_correct.a / 10) * 100;
                    strugglingStudents.push({
                        student_id: student.id,
                        school_id: school.id,
                        domain: 'a',
                        score: exam.items_correct.a,
                        percentage: percentage,
                        exam_id: exam.exam_id
                    });
                }
                if (exam.items_correct.b < threshold) {
                    const percentage = (exam.items_correct.b / 10) * 100;
                    strugglingStudents.push({
                        student_id: student.id,
                        school_id: school.id,
                        domain: 'b',
                        score: exam.items_correct.b,
                        percentage: percentage,
                        exam_id: exam.exam_id
                    });
                }
                if (exam.items_correct.c < threshold) {
                    const percentage = (exam.items_correct.c / 10) * 100;
                    strugglingStudents.push({
                        student_id: student.id,
                        school_id: school.id,
                        domain: 'c',
                        score: exam.items_correct.c,
                        percentage: percentage,
                        exam_id: exam.exam_id
                    });
                }
            }
        }
    }
    if (strugglingStudents.length === 0) {
        return `No students found struggling in School ${schoolId}${domain ? ` in domain ${domain.toUpperCase()}` : ''} with threshold ${threshold}/10 (${(threshold / 10 * 100)}%).`;
    }
    let analysis = [`Students Struggling in School ${schoolId}${domain ? ` in Domain ${domain.toUpperCase()}` : ''} (below ${threshold}/10 questions or ${(threshold / 10 * 100)}%):`];
    for (const student of strugglingStudents) {
        analysis.push(`- Student ${student.student_id}: Domain ${student.domain.toUpperCase()} ${student.score}/10 (${student.percentage.toFixed(1)}%) in ${student.exam_id}`);
    }
    return analysis.join('\n');
}
function getSchoolOverview(schoolId) {
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
            totalA += exam.items_correct.a;
            totalB += exam.items_correct.b;
            totalC += exam.items_correct.c;
            totalExams++;
        }
    }
    if (totalExams > 0) {
        const avgScore = (totalScore / totalExams).toFixed(1);
        const avgA = (totalA / totalExams).toFixed(1);
        const avgB = (totalB / totalExams).toFixed(1);
        const avgC = (totalC / totalExams).toFixed(1);
        overview.push(`Total Exams: ${totalExams}`);
        overview.push(`Average Exam Score: ${avgScore}%`);
        overview.push(`\nAverage Domain Performance:`);
        overview.push(`  Domain A: ${avgA}/10 (${((totalA / totalExams) / 10 * 100).toFixed(1)}%)`);
        overview.push(`  Domain B: ${avgB}/10 (${((totalB / totalExams) / 10 * 100).toFixed(1)}%)`);
        overview.push(`  Domain C: ${avgC}/10 (${((totalC / totalExams) / 10 * 100).toFixed(1)}%)`);
    }
    else {
        overview.push(`No exam data available for school ${schoolId}`);
    }
    return overview.join('\n');
}
const app = (0, express_1.default)();
// to support multiple simultaneous connections we have a lookup object from
// sessionId to transport
const transports = {};
app.get("/sse", (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    const transport = new sse_js_1.SSEServerTransport("/messages", res);
    transports[transport.sessionId] = transport;
    res.on("close", () => {
        delete transports[transport.sessionId];
        console.log(`Connection closed for session: ${transport.sessionId}`);
    });
    console.log(`New connection established for session: ${transport.sessionId}`);
    yield server.connect(transport);
}));
// Apply NO body parsing middleware to this route
app.post("/messages", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const sessionId = req.query.sessionId;
    const transport = transports[sessionId];
    if (transport) {
        // Let handlePostMessage read the raw stream directly
        yield transport.handlePostMessage(req, res);
    }
    else {
        console.error(`No transport found for sessionId: ${sessionId}`);
        res.status(400).send("No transport found for sessionId");
    }
}));
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Educational Insights SSE server listening on port ${PORT}`);
    console.log(`Loaded data for ${schoolData.schools.length} schools`);
});
