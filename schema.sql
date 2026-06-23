-- 1. Students Node Table
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    github_url VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Skills Node Table (Taxonomy of skills)
CREATE TABLE IF NOT EXISTS skills (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'Programming Languages', 'Web Frameworks', 'Databases', 'Cloud & DevOps', 'Soft Skills'
    description TEXT
);

-- 3. Skill Dependency Edges (Sub-skills, Prerequisites)
CREATE TABLE IF NOT EXISTS skill_dependencies (
    parent_skill_id INTEGER REFERENCES skills(id) ON DELETE CASCADE,
    child_skill_id INTEGER REFERENCES skills(id) ON DELETE CASCADE,
    dependency_type VARCHAR(30) DEFAULT 'requires', -- 'requires', 'recommends', 'subset_of'
    PRIMARY KEY (parent_skill_id, child_skill_id)
);

-- 4. Student-to-Skill Mapping Edges
CREATE TABLE IF NOT EXISTS student_skills (
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    skill_id INTEGER REFERENCES skills(id) ON DELETE CASCADE,
    proficiency INTEGER CHECK (proficiency BETWEEN 1 AND 5), -- 1: Beginner, 5: Expert
    confidence_score NUMERIC(3, 2) DEFAULT 0.5, -- Confidence in parsing source (0.0 to 1.0)
    source VARCHAR(50), -- 'resume_upload', 'github_profile', 'cert_verification'
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id, skill_id)
);

-- 5. Career Role Nodes
CREATE TABLE IF NOT EXISTS career_roles (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

-- 6. Role Requirements Edges
CREATE TABLE IF NOT EXISTS role_skills (
    role_id INTEGER REFERENCES career_roles(id) ON DELETE CASCADE,
    skill_id INTEGER REFERENCES skills(id) ON DELETE CASCADE,
    min_proficiency INTEGER CHECK (min_proficiency BETWEEN 1 AND 5),
    importance_weight NUMERIC(3, 2) DEFAULT 1.0,
    PRIMARY KEY (role_id, skill_id)
);

-- 7. Project Nodes (For Team Formation)
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,
    required_team_size INTEGER DEFAULT 3
);

-- 8. Project-to-Skill Edges (Project Role Requirements)
CREATE TABLE IF NOT EXISTS project_requirements (
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    skill_id INTEGER REFERENCES skills(id) ON DELETE CASCADE,
    role_name VARCHAR(50) NOT NULL, -- e.g., 'Lead Backend', 'Frontend Dev', 'UI Designer', 'Project Manager'
    min_proficiency INTEGER CHECK (min_proficiency BETWEEN 1 AND 5),
    PRIMARY KEY (project_id, skill_id, role_name)
);
