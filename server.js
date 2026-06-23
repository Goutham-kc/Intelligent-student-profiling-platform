const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');
const db = require('./db');
const parser = require('./parser');
const analytics = require('./analytics');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve the web interface files

// API 1: Get all students
app.get('/api/students', async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM students ORDER BY name ASC");
        res.json(result.rows);
    } catch (err) {
        console.error("Error retrieving students:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// API 2: Get a student by ID
app.get('/api/students/:id', async (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        const result = await db.query("SELECT * FROM students WHERE id = $1", [studentId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Student not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API 3: Get student skills (individual skill edges)
app.get('/api/students/:id/skills', async (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        const result = await db.query(
            `SELECT ss.skill_id, ss.proficiency, ss.confidence_score, ss.source, s.name, s.category
             FROM student_skills ss
             JOIN skills s ON ss.skill_id = s.id
             WHERE ss.student_id = $1`,
            [studentId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API 4: Ingest a new resume or coding profile
app.post('/api/students/ingest', upload.single('resume'), async (req, res) => {
    const { name, email, githubUrl, source } = req.body;
    let { profileText } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: "Required fields missing: name, email." });
    }

    try {
        // Handle PDF file upload parsing
        if (req.file) {
            try {
                const pdfParser = new PDFParse({ data: req.file.buffer, verbosity: 0 });
                const pdfData = await pdfParser.getText();
                profileText = pdfData.text;
            } catch (pdfErr) {
                console.error("PDF parsing failed:", pdfErr.message);
                return res.status(400).json({ error: "Failed to parse PDF resume: " + pdfErr.message });
            }
        }

        if (!profileText || profileText.trim() === '') {
            return res.status(400).json({ error: "No profile text or PDF file provided." });
        }

        // Step 1: Create or update student node
        let student;
        const checkStudent = await db.query("SELECT * FROM students WHERE email = $1", [email]);
        
        if (checkStudent.rows.length > 0) {
            // Update existing
            student = checkStudent.rows[0];
            await db.query(
                "UPDATE students SET name = $1, github_url = $2 WHERE id = $3",
                [name, githubUrl || student.github_url, student.id]
            );
            student.name = name;
            student.github_url = githubUrl || student.github_url;
        } else {
            // Insert new
            const insertResult = await db.query(
                "INSERT INTO students (name, email, github_url) VALUES ($1, $2, $3) RETURNING *",
                [name, email, githubUrl || '']
            );
            student = insertResult.rows[0];
        }

        // Step 2: Parse text using NLP engine
        const parsedSkills = parser.parseProfile(profileText, source || 'resume_upload');

        // Step 3: Insert or update skill mappings in database
        const savedSkills = [];
        for (const skill of parsedSkills) {
            // Get canonical skill ID from db
            const skillResult = await db.query("SELECT id FROM skills WHERE name = $1", [skill.name]);
            if (skillResult.rows.length > 0) {
                const skillId = skillResult.rows[0].id;
                
                await db.query(
                    `INSERT INTO student_skills (student_id, skill_id, proficiency, confidence_score, source)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (student_id, skill_id) 
                     DO UPDATE SET proficiency = EXCLUDED.proficiency, confidence_score = EXCLUDED.confidence_score, source = EXCLUDED.source, updated_at = CURRENT_TIMESTAMP`,
                    [student.id, skillId, skill.proficiency, skill.confidence, skill.source]
                );
                
                savedSkills.push({
                    skillId,
                    name: skill.name,
                    proficiency: skill.proficiency,
                    confidence: skill.confidence,
                    source: skill.source
                });
            }
        }

        res.json({
            success: true,
            message: `Successfully ingested profile. Extracted and mapped ${savedSkills.length} skills.`,
            student,
            skillsExtracted: savedSkills
        });

    } catch (err) {
        console.error("Ingestion failed:", err);
        res.status(500).json({ error: err.message });
    }
});

// API 5: Delete a student
app.delete('/api/students/:id', async (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        await db.query("DELETE FROM students WHERE id = $1", [studentId]);
        res.json({ success: true, message: `Student ID ${studentId} deleted successfully.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API 6: Get all skills in database taxonomy
app.get('/api/skills', async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM skills");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API 7: Get all skill dependencies (for graph visualization)
app.get('/api/skill-dependencies', async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM skill_dependencies");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API 8: Get career roles list
app.get('/api/career-roles', async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM career_roles");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API 9: Perform career matches & skill gap analysis for a student
app.get('/api/students/:id/gap-analysis', async (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        const analysis = await analytics.analyzeSkillGaps(studentId);
        res.json(analysis);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API 10: Generate prerequisite-based learning path for a student's gap
app.get('/api/students/:id/learning-path/:roleId', async (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        const roleId = parseInt(req.params.roleId);
        const path = await analytics.buildLearningPath(studentId, roleId);
        res.json(path);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API 11: Get all project templates
app.get('/api/projects', async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM projects");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API 12: Assemble balanced team for project ID
app.get('/api/projects/:id/form-team', async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const teamResult = await analytics.formProjectTeam(projectId);
        res.json(teamResult);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API 13: Fetch SQL logs for visual dashboard debug panel
app.get('/api/db/logs', (req, res) => {
    res.json({ logs: db.getLogs(), isMock: db.isMock() });
});

// API 14: Clear SQL logs
app.post('/api/db/logs/clear', (req, res) => {
    db.clearLogs();
    res.json({ success: true });
});

// Start Server
app.listen(PORT, () => {
    console.log(`=============================================================`);
    console.log(` Intelligent Student Profiling Server running on port ${PORT}`);
    console.log(` Local web UI accessible at: http://localhost:${PORT}`);
    console.log(`=============================================================`);
});
