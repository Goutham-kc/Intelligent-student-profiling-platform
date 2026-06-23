const { Pool } = require('pg');
require('dotenv').config();

const useRealDb = process.env.USE_REAL_DATABASE === 'true';
let pool = null;
let useMockMode = !useRealDb;

// Global list to store SQL query execution logs
const sqlLogs = [];

function logSQL(queryText, params) {
    const timestamp = new Date().toLocaleTimeString();
    // Format parameters nicely
    const paramStr = params && params.length ? ` | Params: ${JSON.stringify(params)}` : '';
    const logEntry = `[${timestamp}] ${queryText}${paramStr}`;
    sqlLogs.push(logEntry);
    
    // Keep logs size reasonable
    if (sqlLogs.length > 100) {
        sqlLogs.shift();
    }
    
    console.log(`\x1b[35m[SQL LOG]\x1b[0m ${queryText}`);
    if (params && params.length) {
        console.log(`\x1b[36m  Params:\x1b[0m ${JSON.stringify(params)}`);
    }
}

// In-Memory Database for Mock Mode
const mockDb = {
    students: [
        { id: 1, name: "Arjun Mehta", email: "arjun.mehta@example.edu", github_url: "github.com/arjunm", created_at: new Date() },
        { id: 2, name: "Priya Sharma", email: "priya.s@example.edu", github_url: "github.com/priyasharma", created_at: new Date() },
        { id: 3, name: "Rohan Das", email: "rohan.das@example.edu", github_url: "github.com/rohandas-dev", created_at: new Date() }
    ],
    skills: [
        // Programming Languages
        { id: 1, name: "JavaScript", category: "Programming Languages", description: "High-level scripting language" },
        { id: 2, name: "Python", category: "Programming Languages", description: "Interpreted high-level language, great for data science" },
        { id: 3, name: "Java", category: "Programming Languages", description: "Class-based object-oriented language" },
        { id: 4, name: "C++", category: "Programming Languages", description: "General-purpose programming language" },
        { id: 5, name: "Go", category: "Programming Languages", description: "Compiled language designed at Google" },
        
        // Web Frameworks
        { id: 6, name: "React", category: "Web Frameworks", description: "UI library by Meta" },
        { id: 7, name: "Express", category: "Web Frameworks", description: "Backend framework for Node.js" },
        { id: 8, name: "Django", category: "Web Frameworks", description: "High-level Python web framework" },
        { id: 9, name: "Spring Boot", category: "Web Frameworks", description: "Java-based framework for microservices" },
        
        // Databases
        { id: 10, name: "PostgreSQL", category: "Databases", description: "Relational SQL database" },
        { id: 11, name: "MongoDB", category: "Databases", description: "NoSQL document database" },
        { id: 12, name: "ShaktiDB", category: "Databases", description: "Sovereign India-scale database built on PostgreSQL" },
        
        // Cloud & DevOps
        { id: 13, name: "Docker", category: "Cloud & DevOps", description: "OS-level virtualization tool" },
        { id: 14, name: "AWS", category: "Cloud & DevOps", description: "Amazon Web Services cloud platform" },
        { id: 15, name: "Git", category: "Cloud & DevOps", description: "Distributed version control system" },
        
        // Soft Skills
        { id: 16, name: "Leadership", category: "Soft Skills", description: "Ability to guide and influence others" },
        { id: 17, name: "Communication", category: "Soft Skills", description: "Effective exchanging of information" },
        { id: 18, name: "Teamwork", category: "Soft Skills", description: "Collaborative action of a group" },
        { id: 19, name: "Problem Solving", category: "Soft Skills", description: "Identifying and resolving complex issues" }
    ],
    skill_dependencies: [
        { parent_skill_id: 1, child_skill_id: 6, dependency_type: "requires" }, // React -> JavaScript
        { parent_skill_id: 1, child_skill_id: 7, dependency_type: "requires" }, // Express -> JavaScript
        { parent_skill_id: 2, child_skill_id: 8, dependency_type: "requires" }, // Django -> Python
        { parent_skill_id: 3, child_skill_id: 9, dependency_type: "requires" }, // Spring Boot -> Java
        { parent_skill_id: 10, child_skill_id: 12, dependency_type: "subset_of" } // ShaktiDB -> PostgreSQL
    ],
    student_skills: [
        // Arjun: Javascript/React developer with some databases and teamwork
        { student_id: 1, skill_id: 1, proficiency: 4, confidence_score: 0.9, source: "resume_upload" }, // JS
        { student_id: 1, skill_id: 6, proficiency: 4, confidence_score: 0.85, source: "github_profile" }, // React
        { student_id: 1, skill_id: 7, proficiency: 3, confidence_score: 0.75, source: "resume_upload" }, // Express
        { student_id: 1, skill_id: 10, proficiency: 3, confidence_score: 0.8, source: "cert_verification" }, // Postgres
        { student_id: 1, skill_id: 18, proficiency: 4, confidence_score: 0.7, source: "resume_upload" }, // Teamwork
        
        // Priya: Data Scientist with Python, SQL, ShaktiDB, and Problem Solving
        { student_id: 2, skill_id: 2, proficiency: 5, confidence_score: 0.95, source: "resume_upload" }, // Python
        { student_id: 2, skill_id: 10, proficiency: 4, confidence_score: 0.85, source: "cert_verification" }, // Postgres
        { student_id: 2, skill_id: 12, proficiency: 4, confidence_score: 0.9, source: "cert_verification" }, // ShaktiDB
        { student_id: 2, skill_id: 19, proficiency: 5, confidence_score: 0.8, source: "resume_upload" }, // Problem Solving
        { student_id: 2, skill_id: 17, proficiency: 4, confidence_score: 0.75, source: "resume_upload" }, // Communication
        
        // Rohan: DevOps engineer with C++, Docker, AWS, Git, and Leadership
        { student_id: 3, skill_id: 4, proficiency: 4, confidence_score: 0.85, source: "github_profile" }, // C++
        { student_id: 3, skill_id: 13, proficiency: 4, confidence_score: 0.9, source: "resume_upload" }, // Docker
        { student_id: 3, skill_id: 14, proficiency: 3, confidence_score: 0.8, source: "resume_upload" }, // AWS
        { student_id: 3, skill_id: 15, proficiency: 5, confidence_score: 0.95, source: "github_profile" }, // Git
        { student_id: 3, skill_id: 16, proficiency: 4, confidence_score: 0.7, source: "resume_upload" } // Leadership
    ],
    career_roles: [
        { id: 1, title: "Full Stack Developer", description: "Responsible for building frontend and backend portions of web apps." },
        { id: 2, title: "Data Scientist", description: "Analyzes and interprets complex data to help institutions make decisions." },
        { id: 3, title: "DevOps Engineer", description: "Manages infrastructure, deployments, and CI/CD pipelines." },
        { id: 4, title: "Product Manager", description: "Guides the development and launch of key software initiatives." }
    ],
    role_skills: [
        // Full Stack: JS (4), React (4), Express (3), PostgreSQL (3), Teamwork (3)
        { role_id: 1, skill_id: 1, min_proficiency: 4, importance_weight: 1.0 },
        { role_id: 1, skill_id: 6, min_proficiency: 4, importance_weight: 0.9 },
        { role_id: 1, skill_id: 7, min_proficiency: 3, importance_weight: 0.8 },
        { role_id: 1, skill_id: 10, min_proficiency: 3, importance_weight: 0.8 },
        { role_id: 1, skill_id: 18, min_proficiency: 3, importance_weight: 0.6 },
        
        // Data Scientist: Python (4), PostgreSQL (3), ShaktiDB (3), Problem Solving (4), Communication (3)
        { role_id: 2, skill_id: 2, min_proficiency: 4, importance_weight: 1.0 },
        { role_id: 2, skill_id: 10, min_proficiency: 3, importance_weight: 0.7 },
        { role_id: 2, skill_id: 12, min_proficiency: 3, importance_weight: 0.8 },
        { role_id: 2, skill_id: 19, min_proficiency: 4, importance_weight: 0.9 },
        { role_id: 2, skill_id: 17, min_proficiency: 3, importance_weight: 0.7 },
        
        // DevOps: Docker (4), AWS (3), Git (4), Problem Solving (4)
        { role_id: 3, skill_id: 13, min_proficiency: 4, importance_weight: 1.0 },
        { role_id: 3, skill_id: 14, min_proficiency: 3, importance_weight: 0.8 },
        { role_id: 3, skill_id: 15, min_proficiency: 4, importance_weight: 0.9 },
        { role_id: 3, skill_id: 19, min_proficiency: 4, importance_weight: 0.8 },

        // Product Manager: Leadership (4), Communication (4), Teamwork (4), Problem Solving (3)
        { role_id: 4, skill_id: 16, min_proficiency: 4, importance_weight: 1.0 },
        { role_id: 4, skill_id: 17, min_proficiency: 4, importance_weight: 1.0 },
        { role_id: 4, skill_id: 18, min_proficiency: 4, importance_weight: 0.8 },
        { role_id: 4, skill_id: 19, min_proficiency: 3, importance_weight: 0.7 }
    ],
    projects: [
        { id: 1, title: "E-Commerce Web Portal", description: "Modern retail platform needing UI, backend, and DB coordination.", required_team_size: 3 },
        { id: 2, title: "AI Career Advisory Agent", description: "Smart system providing student guidance using data graphs.", required_team_size: 3 },
        { id: 3, title: "Cloud Automation Pipeline", description: "Migrating institutional databases to scalable cloud stacks.", required_team_size: 2 }
    ],
    project_requirements: [
        // E-Commerce: React (min 4, Front Dev), Express (min 3, Back Dev), PostgreSQL (min 3, DB Admin)
        { project_id: 1, skill_id: 6, role_name: "Frontend Developer", min_proficiency: 4 },
        { project_id: 1, skill_id: 7, role_name: "Backend Developer", min_proficiency: 3 },
        { project_id: 1, skill_id: 10, role_name: "Database Administrator", min_proficiency: 3 },
        
        // AI Counselor: Python (min 4, Data Scientist), SQL/Postgres (min 3, Analyst), Leadership (min 3, Team Lead)
        { project_id: 2, skill_id: 2, role_name: "Data Scientist", min_proficiency: 4 },
        { project_id: 2, skill_id: 10, role_name: "Data Analyst", min_proficiency: 3 },
        { project_id: 2, skill_id: 16, role_name: "Team Lead", min_proficiency: 3 },
        
        // Cloud Migration: AWS (min 3, Cloud Architect), Docker (min 4, DevOps Engineer)
        { project_id: 3, skill_id: 14, role_name: "Cloud Architect", min_proficiency: 3 },
        { project_id: 3, skill_id: 13, role_name: "DevOps Engineer", min_proficiency: 4 }
    ]
};

// Start Database Pool if requested
if (useRealDb) {
    console.log("Connecting to PostgreSQL/ShaktiDB database...");
    pool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_DATABASE,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432'),
    });
    
    // Quick test connection
    pool.query('SELECT NOW()', (err, res) => {
        if (err) {
            console.error("\x1b[31m[ShaktiDB Connection Error]\x1b[0m", err.message);
            console.log("\x1b[33mFalling back to IN-MEMORY MOCK database mode for local testing.\x1b[0m");
            useMockMode = true;
        } else {
            console.log("\x1b[32m[ShaktiDB Connection Successful]\x1b[0m running on standard PostgreSQL compatibility layer.");
        }
    });
} else {
    console.log("\x1b[33mRunning in IN-MEMORY MOCK database mode. No SQL database connection required.\x1b[0m");
}

// SQL Emulator logic
async function mockQuery(text, params) {
    const queryNormalized = text.replace(/\s+/g, ' ').trim();
    
    // 1. Students Table Queries
    if (queryNormalized.match(/FROM students/i)) {
        if (queryNormalized.match(/id\s*=\s*\$1/i)) {
            const student = mockDb.students.find(s => s.id === params[0]);
            return { rows: student ? [student] : [] };
        }
        if (queryNormalized.match(/email\s*=\s*\$1/i)) {
            const student = mockDb.students.find(s => s.email.toLowerCase() === params[0].toLowerCase());
            return { rows: student ? [student] : [] };
        }
        // Return sorted or plain list
        const list = [...mockDb.students];
        if (queryNormalized.match(/ORDER BY name/i)) {
            list.sort((a, b) => a.name.localeCompare(b.name));
        }
        return { rows: list };
    }
    
    // 2. INSERT INTO students
    if (queryNormalized.match(/INSERT INTO students/i)) {
        const newStudent = {
            id: mockDb.students.length + 1,
            name: params[0],
            email: params[1],
            github_url: params[2] || '',
            created_at: new Date()
        };
        mockDb.students.push(newStudent);
        return { rows: [newStudent] };
    }

    // 3. UPDATE students
    if (queryNormalized.match(/UPDATE students SET/i)) {
        const name = params[0];
        const github_url = params[1];
        const id = parseInt(params[2]);
        const student = mockDb.students.find(s => s.id === id);
        if (student) {
            student.name = name;
            student.github_url = github_url;
        }
        return { rows: student ? [student] : [] };
    }
    
    // 4. DELETE FROM students
    if (queryNormalized.match(/DELETE FROM students/i)) {
        const id = parseInt(params[0]);
        const index = mockDb.students.findIndex(s => s.id === id);
        if (index !== -1) {
            mockDb.students.splice(index, 1);
            // clean up skills
            mockDb.student_skills = mockDb.student_skills.filter(ss => ss.student_id !== id);
        }
        return { rows: [] };
    }
    
    // 5. Skills Table Queries
    if (queryNormalized.match(/FROM skills/i) && !queryNormalized.match(/student_skills/i) && !queryNormalized.match(/role_skills/i) && !queryNormalized.match(/project_requirements/i)) {
        if (queryNormalized.match(/name\s*=\s*\$1/i)) {
            const skill = mockDb.skills.find(s => s.name.toLowerCase() === params[0].toLowerCase());
            return { rows: skill ? [skill] : [] };
        }
        if (queryNormalized.match(/id\s*=\s*\$1/i)) {
            const skill = mockDb.skills.find(s => s.id === params[0]);
            return { rows: skill ? [skill] : [] };
        }
        return { rows: mockDb.skills };
    }
    
    // 6. INSERT INTO skills
    if (queryNormalized.match(/INSERT INTO skills/i)) {
        const name = params[0];
        const category = params[1];
        const description = params[2] || '';
        let skill = mockDb.skills.find(s => s.name.toLowerCase() === name.toLowerCase());
        if (!skill) {
            skill = { id: mockDb.skills.length + 1, name, category, description };
            mockDb.skills.push(skill);
        }
        return { rows: [skill] };
    }
    
    // 7. Student Skills Edge Queries
    if (queryNormalized.match(/FROM student_skills/i) && queryNormalized.match(/student_id\s*=\s*\$1/i)) {
        const studentId = params[0];
        const list = mockDb.student_skills
            .filter(ss => ss.student_id === studentId)
            .map(ss => {
                const s = mockDb.skills.find(sk => sk.id === ss.skill_id);
                return {
                    student_id: ss.student_id,
                    skill_id: ss.skill_id,
                    proficiency: ss.proficiency,
                    confidence_score: ss.confidence_score,
                    source: ss.source,
                    name: s ? s.name : 'Unknown',
                    category: s ? s.category : 'Unknown',
                    description: s ? s.description : ''
                };
            });
        return { rows: list };
    }
    
    // 8. INSERT INTO student_skills
    if (queryNormalized.match(/INSERT INTO student_skills/i)) {
        const student_id = params[0];
        const skill_id = params[1];
        const proficiency = params[2];
        const confidence_score = params[3];
        const source = params[4];
        
        let match = mockDb.student_skills.find(ss => ss.student_id === student_id && ss.skill_id === skill_id);
        if (match) {
            match.proficiency = proficiency;
            match.confidence_score = confidence_score;
            match.source = source;
            match.updated_at = new Date();
        } else {
            match = { student_id, skill_id, proficiency, confidence_score, source, updated_at: new Date() };
            mockDb.student_skills.push(match);
        }
        return { rows: [match] };
    }
    
    // 9. Skill Dependencies
    if (queryNormalized.match(/FROM skill_dependencies/i)) {
        return { rows: mockDb.skill_dependencies };
    }
    
    // 10. Career Roles
    if (queryNormalized.match(/FROM career_roles/i) && !queryNormalized.match(/role_skills/i)) {
        if (queryNormalized.match(/id\s*=\s*\$1/i)) {
            const role = mockDb.career_roles.find(r => r.id === params[0]);
            return { rows: role ? [role] : [] };
        }
        return { rows: mockDb.career_roles };
    }
    
    // 11. Career Role Skills Requirements
    if (queryNormalized.match(/FROM role_skills/i) && queryNormalized.match(/role_id\s*=\s*\$1/i)) {
        const roleId = params[0];
        const list = mockDb.role_skills
            .filter(rs => rs.role_id === roleId)
            .map(rs => {
                const s = mockDb.skills.find(sk => sk.id === rs.skill_id);
                return {
                    role_id: rs.role_id,
                    skill_id: rs.skill_id,
                    min_proficiency: rs.min_proficiency,
                    importance_weight: rs.importance_weight,
                    name: s ? s.name : 'Unknown',
                    category: s ? s.category : 'Unknown',
                    description: s ? s.description : ''
                };
            });
        return { rows: list };
    }
    
    // 12. Projects
    if (queryNormalized.match(/FROM projects/i) && !queryNormalized.match(/project_requirements/i)) {
        if (queryNormalized.match(/id\s*=\s*\$1/i)) {
            const project = mockDb.projects.find(p => p.id === params[0]);
            return { rows: project ? [project] : [] };
        }
        return { rows: mockDb.projects };
    }
    
    // 13. Project Requirements
    if (queryNormalized.match(/FROM project_requirements/i) && queryNormalized.match(/project_id\s*=\s*\$1/i)) {
        const projectId = params[0];
        const list = mockDb.project_requirements
            .filter(pr => pr.project_id === projectId)
            .map(pr => {
                const s = mockDb.skills.find(sk => sk.id === pr.skill_id);
                return {
                    project_id: pr.project_id,
                    skill_id: pr.skill_id,
                    role_name: pr.role_name,
                    min_proficiency: pr.min_proficiency,
                    name: s ? s.name : 'Unknown',
                    category: s ? s.category : 'Unknown',
                    description: s ? s.description : ''
                };
            });
        return { rows: list };
    }

    return { rows: [] };
}

module.exports = {
    query: async (text, params) => {
        logSQL(text, params);
        if (useMockMode) {
            return await mockQuery(text, params);
        } else {
            return await pool.query(text, params);
        }
    },
    getLogs: () => sqlLogs,
    clearLogs: () => { sqlLogs.length = 0; },
    isMock: () => useMockMode,
    getMockDb: () => mockDb // For testing/analytics convenience
};
