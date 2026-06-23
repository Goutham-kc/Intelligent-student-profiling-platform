const db = require('./db');
const fs = require('fs');
const path = require('path');

async function runSeed() {
    console.log("Starting database seeding process...");
    
    if (!db.isMock()) {
        try {
            console.log("Reading schema.sql to initialize database tables...");
            const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
            // Execute the schema queries
            await db.query(schemaSql);
            console.log("Schema initialized successfully.");
        } catch (err) {
            console.error("Error creating tables from schema.sql:", err.message);
            process.exit(1);
        }
    } else {
        console.log("Running in MOCK mode. Schema SQL parsing will be simulated.");
        await db.query("CREATE TABLE IF NOT EXISTS students ( ... )");
        await db.query("CREATE TABLE IF NOT EXISTS skills ( ... )");
        await db.query("CREATE TABLE IF NOT EXISTS skill_dependencies ( ... )");
        await db.query("CREATE TABLE IF NOT EXISTS student_skills ( ... )");
        await db.query("CREATE TABLE IF NOT EXISTS career_roles ( ... )");
        await db.query("CREATE TABLE IF NOT EXISTS role_skills ( ... )");
        await db.query("CREATE TABLE IF NOT EXISTS projects ( ... )");
        await db.query("CREATE TABLE IF NOT EXISTS project_requirements ( ... )");
    }

    // 1. Seed Skills
    console.log("Seeding skills taxonomy...");
    const skillsToSeed = [
        // Languages
        ["JavaScript", "Programming Languages", "High-level scripting language"],
        ["Python", "Programming Languages", "Interpreted high-level language, great for data science"],
        ["Java", "Programming Languages", "Class-based object-oriented language"],
        ["C++", "Programming Languages", "General-purpose programming language"],
        ["Go", "Programming Languages", "Compiled language designed at Google"],
        // Frameworks
        ["React", "Web Frameworks", "UI library by Meta"],
        ["Express", "Web Frameworks", "Backend framework for Node.js"],
        ["Django", "Web Frameworks", "High-level Python web framework"],
        ["Spring Boot", "Web Frameworks", "Java-based framework for microservices"],
        // Databases
        ["PostgreSQL", "Databases", "Relational SQL database"],
        ["MongoDB", "Databases", "NoSQL document database"],
        ["ShaktiDB", "Databases", "Sovereign India-scale database built on PostgreSQL"],
        // DevOps
        ["Docker", "Cloud & DevOps", "OS-level virtualization tool"],
        ["AWS", "Cloud & DevOps", "Amazon Web Services cloud platform"],
        ["Git", "Cloud & DevOps", "Distributed version control system"],
        // Soft Skills
        ["Leadership", "Soft Skills", "Ability to guide and influence others"],
        ["Communication", "Soft Skills", "Effective exchanging of information"],
        ["Teamwork", "Soft Skills", "Collaborative action of a group"],
        ["Problem Solving", "Soft Skills", "Identifying and resolving complex issues"]
    ];

    for (const s of skillsToSeed) {
        await db.query(
            `INSERT INTO skills (name, category, description) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category, description = EXCLUDED.description`, 
            s
        );
    }

    // 2. Fetch skill IDs (mock or real) to map dependencies
    // In mock mode, we assume the IDs correspond to our array indices (1-indexed)
    console.log("Seeding skill dependency paths...");
    const dependencies = [
        [1, 6], // React -> requires -> JavaScript
        [1, 7], // Express -> requires -> JavaScript
        [2, 8], // Django -> requires -> Python
        [3, 9], // Spring Boot -> requires -> Java
        [10, 12] // ShaktiDB -> subset_of -> PostgreSQL
    ];

    for (const dep of dependencies) {
        if (!db.isMock()) {
            await db.query(
                `INSERT INTO skill_dependencies (parent_skill_id, child_skill_id, dependency_type) 
                 VALUES ($1, $2, 'requires') 
                 ON CONFLICT DO NOTHING`,
                dep
            );
        } else {
            await db.query(`INSERT INTO skill_dependencies (parent_skill_id, child_skill_id) VALUES (${dep[0]}, ${dep[1]})`);
        }
    }

    // 3. Seed Career Roles
    console.log("Seeding career blueprints...");
    const roles = [
        ["Full Stack Developer", "Responsible for building frontend and backend portions of web apps."],
        ["Data Scientist", "Analyzes and interprets complex data to help institutions make decisions."],
        ["DevOps Engineer", "Manages infrastructure, deployments, and CI/CD pipelines."],
        ["Product Manager", "Guides the development and launch of key software initiatives."]
    ];

    for (const r of roles) {
        await db.query(
            `INSERT INTO career_roles (title, description) 
             VALUES ($1, $2) 
             ON CONFLICT (title) DO UPDATE SET description = EXCLUDED.description`,
            r
        );
    }

    // 4. Seed Role Requirements (Skill Requirements mapping)
    console.log("Seeding career role-to-skill edges...");
    const roleRequirements = [
        // Full Stack: JS(4), React(4), Express(3), Postgres(3), Teamwork(3)
        [1, 1, 4, 1.0], [1, 6, 4, 0.9], [1, 7, 3, 0.8], [1, 10, 3, 0.8], [1, 18, 3, 0.6],
        // Data Scientist: Python(4), Postgres(3), ShaktiDB(3), Problem Solving(4), Communication(3)
        [2, 2, 4, 1.0], [2, 10, 3, 0.7], [2, 12, 3, 0.8], [2, 19, 4, 0.9], [2, 17, 3, 0.7],
        // DevOps: Docker(4), AWS(3), Git(4), Problem Solving(4)
        [3, 13, 4, 1.0], [3, 14, 3, 0.8], [3, 15, 4, 0.9], [3, 19, 4, 0.8],
        // PM: Leadership(4), Communication(4), Teamwork(4), Problem Solving(3)
        [4, 16, 4, 1.0], [4, 17, 4, 1.0], [4, 18, 4, 0.8], [4, 19, 3, 0.7]
    ];

    for (const rr of roleRequirements) {
        if (!db.isMock()) {
            await db.query(
                `INSERT INTO role_skills (role_id, skill_id, min_proficiency, importance_weight) 
                 VALUES ($1, $2, $3, $4) 
                 ON CONFLICT (role_id, skill_id) DO UPDATE 
                 SET min_proficiency = EXCLUDED.min_proficiency, importance_weight = EXCLUDED.importance_weight`,
                rr
            );
        } else {
            await db.query(`INSERT INTO role_skills (role_id, skill_id, min_proficiency) VALUES (${rr[0]}, ${rr[1]}, ${rr[2]})`);
        }
    }

    // 5. Seed Projects & Requirements
    console.log("Seeding project templates...");
    const projects = [
        ["E-Commerce Web Portal", "Modern retail platform needing UI, backend, and DB coordination.", 3],
        ["AI Career Advisory Agent", "Smart system providing student guidance using data graphs.", 3],
        ["Cloud Automation Pipeline", "Migrating institutional databases to scalable cloud stacks.", 2]
    ];

    for (const p of projects) {
        await db.query(
            `INSERT INTO projects (title, description, required_team_size) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (title) DO UPDATE SET description = EXCLUDED.description, required_team_size = EXCLUDED.required_team_size`,
            p
        );
    }

    const projectRequirements = [
        // E-Commerce: React (min 4, Front Dev), Express (min 3, Back Dev), PostgreSQL (min 3, DB Admin)
        [1, 6, "Frontend Developer", 4],
        [1, 7, "Backend Developer", 3],
        [1, 10, "Database Administrator", 3],
        
        // AI Counselor: Python (min 4, Data Scientist), SQL (min 3, Data Analyst), Leadership (min 3, Team Lead)
        [2, 2, "Data Scientist", 4],
        [2, 10, "Data Analyst", 3],
        [2, 16, "Team Lead", 3],
        
        // Cloud Migration: AWS (min 3, Cloud Architect), Docker (min 4, DevOps Engineer)
        [3, 14, "Cloud Architect", 3],
        [3, 13, "DevOps Engineer", 4]
    ];

    for (const pr of projectRequirements) {
        if (!db.isMock()) {
            await db.query(
                `INSERT INTO project_requirements (project_id, skill_id, role_name, min_proficiency) 
                 VALUES ($1, $2, $3, $4) 
                 ON CONFLICT (project_id, skill_id, role_name) DO UPDATE SET min_proficiency = EXCLUDED.min_proficiency`,
                pr
            );
        } else {
            await db.query(`INSERT INTO project_requirements (project_id, skill_id, role_name, min_proficiency) VALUES (${pr[0]}, ${pr[1]}, '${pr[2]}', ${pr[3]})`);
        }
    }

    // 6. Seed Students (only if database is empty/first run)
    if (!db.isMock()) {
        const studentCheck = await db.query("SELECT COUNT(*) FROM students");
        const count = parseInt(studentCheck.rows[0].count);
        if (count === 0) {
            console.log("No students found. Seeding mock student nodes and mapping skills...");
            
            // Arjun Mehta
            const s1 = await db.query("INSERT INTO students (name, email, github_url) VALUES ('Arjun Mehta', 'arjun.mehta@example.edu', 'github.com/arjunm') RETURNING id");
            const s1_id = s1.rows[0].id;
            // JS(4), React(4), Express(3), Postgres(3), Teamwork(4)
            await db.query(`INSERT INTO student_skills (student_id, skill_id, proficiency, confidence_score, source) VALUES 
                (${s1_id}, 1, 4, 0.90, 'resume_upload'),
                (${s1_id}, 6, 4, 0.85, 'github_profile'),
                (${s1_id}, 7, 3, 0.75, 'resume_upload'),
                (${s1_id}, 10, 3, 0.80, 'cert_verification'),
                (${s1_id}, 18, 4, 0.70, 'resume_upload')`);

            // Priya Sharma
            const s2 = await db.query("INSERT INTO students (name, email, github_url) VALUES ('Priya Sharma', 'priya.s@example.edu', 'github.com/priyasharma') RETURNING id");
            const s2_id = s2.rows[0].id;
            // Python(5), Postgres(4), ShaktiDB(4), Problem Solving(5), Communication(4)
            await db.query(`INSERT INTO student_skills (student_id, skill_id, proficiency, confidence_score, source) VALUES 
                (${s2_id}, 2, 5, 0.95, 'resume_upload'),
                (${s2_id}, 10, 4, 0.85, 'cert_verification'),
                (${s2_id}, 12, 4, 0.90, 'cert_verification'),
                (${s2_id}, 19, 5, 0.80, 'resume_upload'),
                (${s2_id}, 17, 4, 0.75, 'resume_upload')`);

            // Rohan Das
            const s3 = await db.query("INSERT INTO students (name, email, github_url) VALUES ('Rohan Das', 'rohan.das@example.edu', 'github.com/rohandas-dev') RETURNING id");
            const s3_id = s3.rows[0].id;
            // C++(4), Docker(4), AWS(3), Git(5), Leadership(4)
            await db.query(`INSERT INTO student_skills (student_id, skill_id, proficiency, confidence_score, source) VALUES 
                (${s3_id}, 4, 4, 0.85, 'github_profile'),
                (${s3_id}, 13, 4, 0.90, 'resume_upload'),
                (${s3_id}, 14, 3, 0.80, 'resume_upload'),
                (${s3_id}, 15, 5, 0.95, 'github_profile'),
                (${s3_id}, 16, 4, 0.70, 'resume_upload')`);
        }
    } else {
        console.log("Mock data already pre-loaded in db.js memory cache.");
    }

    console.log("Database seeding completed successfully!");
    process.exit(0);
}

runSeed().catch(err => {
    console.error("Database seeding failed:", err);
    process.exit(1);
});
