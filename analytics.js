const db = require('./db');

/**
 * Perform skill gap analysis for a student against all predefined career roles
 * @param {number} studentId 
 * @returns {Array} - List of role matches with match percentages and gaps
 */
async function analyzeSkillGaps(studentId) {
    // 1. Fetch student's current skills
    const studentSkillsResult = await db.query(
        `SELECT ss.skill_id, ss.proficiency, s.name, s.category 
         FROM student_skills ss 
         JOIN skills s ON ss.skill_id = s.id 
         WHERE ss.student_id = $1`,
        [studentId]
    );
    const studentSkills = studentSkillsResult.rows;
    const studentSkillMap = {};
    studentSkills.forEach(sk => {
        studentSkillMap[sk.skill_id] = sk.proficiency;
    });

    // 2. Fetch all career roles
    const rolesResult = await db.query("SELECT * FROM career_roles");
    const roles = rolesResult.rows;

    const analysis = [];

    // 3. For each role, calculate match percentage and detail gaps
    for (const role of roles) {
        const reqsResult = await db.query(
            `SELECT rs.skill_id, rs.min_proficiency, rs.importance_weight, s.name, s.category 
             FROM role_skills rs 
             JOIN skills s ON rs.skill_id = s.id 
             WHERE rs.role_id = $1`,
            [role.id]
        );
        const requirements = reqsResult.rows;

        if (requirements.length === 0) continue;

        let totalWeight = 0;
        let weightedScore = 0;
        const details = [];

        for (const req of requirements) {
            const importance = parseFloat(req.importance_weight || '1.0');
            totalWeight += importance;

            const studentProf = studentSkillMap[req.skill_id] || 0;
            const minProf = req.min_proficiency;

            let gap = minProf - studentProf;
            let status = 'met';
            let skillScore = 1.0;

            if (studentProf === 0) {
                status = 'missing';
                gap = minProf;
                skillScore = 0;
            } else if (gap > 0) {
                status = 'gap';
                // Score scales down based on how large the gap is
                skillScore = 1 - (gap / minProf);
            } else {
                gap = 0;
                skillScore = 1.0; // Meets or exceeds
            }

            weightedScore += skillScore * importance;

            details.push({
                skillId: req.skill_id,
                skillName: req.name,
                category: req.category,
                studentProficiency: studentProf,
                requiredProficiency: minProf,
                gap,
                status
            });
        }

        const matchPercentage = Math.round((weightedScore / totalWeight) * 100);

        analysis.push({
            roleId: role.id,
            roleTitle: role.title,
            description: role.description,
            matchPercentage,
            details
        });
    }

    // Sort by match percentage descending
    return analysis.sort((a, b) => b.matchPercentage - a.matchPercentage);
}

/**
 * Builds a recommended learning path to bridge the gap for a specific career role
 * Traverses the skill dependency graph to identify prerequisites
 * @param {number} studentId 
 * @param {number} roleId 
 */
async function buildLearningPath(studentId, roleId) {
    // Fetch student skills
    const studentSkillsResult = await db.query(
        "SELECT skill_id, proficiency FROM student_skills WHERE student_id = $1",
        [studentId]
    );
    const studentSkills = {};
    studentSkillsResult.rows.forEach(sk => {
        studentSkills[sk.skill_id] = sk.proficiency;
    });

    // Fetch role requirements
    const reqsResult = await db.query(
        `SELECT rs.skill_id, rs.min_proficiency, s.name 
         FROM role_skills rs 
         JOIN skills s ON rs.skill_id = s.id 
         WHERE rs.role_id = $1`,
        [roleId]
    );
    const gaps = reqsResult.rows.filter(req => {
        const studentProf = studentSkills[req.skill_id] || 0;
        return studentProf < req.min_proficiency;
    });

    // Fetch all skill dependencies for graph traversal
    const depResult = await db.query("SELECT parent_skill_id, child_skill_id FROM skill_dependencies");
    const dependencies = depResult.rows; // parent is prerequisite, child is dependent
    
    // Fetch all skills for name lookup
    const allSkillsResult = await db.query("SELECT id, name, category FROM skills");
    const skillsList = allSkillsResult.rows;
    const skillLookup = {};
    skillsList.forEach(s => { skillLookup[s.id] = s; });

    const pathSteps = [];
    const visited = new Set();

    // Helper function to trace prerequisites (DFS graph traversal)
    async function tracePrerequisites(skillId) {
        if (visited.has(skillId)) return;
        visited.add(skillId);

        // Find parent skills that this skill depends on
        const prerequisites = dependencies.filter(d => d.child_skill_id === skillId);
        
        for (const prep of prerequisites) {
            const parentId = prep.parent_skill_id;
            const studentProf = studentSkills[parentId] || 0;
            
            // If student doesn't have the prerequisite skill at a competent level (>= 3), trace it first
            if (studentProf < 3) {
                await tracePrerequisites(parentId);
                
                // Add to path if not already added
                if (!pathSteps.some(step => step.skillId === parentId)) {
                    pathSteps.push({
                        skillId: parentId,
                        skillName: skillLookup[parentId].name,
                        category: skillLookup[parentId].category,
                        type: 'Prerequisite',
                        reason: `Required before learning ${skillLookup[skillId].name}`,
                        currentProficiency: studentProf,
                        targetProficiency: 3
                    });
                }
            }
        }
    }

    // Trace prerequisites for every skill gap
    for (const gap of gaps) {
        await tracePrerequisites(gap.skill_id);
        
        // Add the target gap skill itself to the path
        const currentProf = studentSkills[gap.skill_id] || 0;
        pathSteps.push({
            skillId: gap.skill_id,
            skillName: gap.name,
            category: skillLookup[gap.skill_id].category,
            type: 'Core Requirement',
            reason: currentProf === 0 ? `Acquire basic and advanced capability` : `Bridge proficiency gap from ${currentProf} to ${gap.min_proficiency}`,
            currentProficiency: currentProf,
            targetProficiency: gap.min_proficiency
        });
    }

    return pathSteps;
}

/**
 * Suggests the optimal, balanced team of students for a specific project
 * @param {number} projectId 
 */
async function formProjectTeam(projectId) {
    // 1. Fetch project requirements
    const reqsResult = await db.query(
        `SELECT pr.skill_id, pr.role_name, pr.min_proficiency, s.name as skill_name
         FROM project_requirements pr
         JOIN skills s ON pr.skill_id = s.id
         WHERE pr.project_id = $1`,
        [projectId]
    );
    const requirements = reqsResult.rows;
    if (requirements.length === 0) {
        throw new Error("No requirements defined for this project.");
    }

    // 2. Fetch project details
    const projResult = await db.query("SELECT * FROM projects WHERE id = $1", [projectId]);
    const project = projResult.rows[0];
    const teamSize = project.required_team_size;

    // 3. Fetch all students and their skills
    const studentsResult = await db.query("SELECT id, name, email FROM students");
    const students = studentsResult.rows;

    const studentSkillsData = [];
    for (const student of students) {
        const skillsResult = await db.query(
            "SELECT skill_id, proficiency FROM student_skills WHERE student_id = $1",
            [student.id]
        );
        const skillMap = {};
        skillsResult.rows.forEach(s => {
            skillMap[s.skill_id] = s.proficiency;
        });
        studentSkillsData.push({
            student,
            skills: skillMap
        });
    }

    // 4. Find combinations of students (subsets of size teamSize)
    const combinations = [];
    function getCombinations(start, activeCombo) {
        if (activeCombo.length === teamSize) {
            combinations.push([...activeCombo]);
            return;
        }
        for (let i = start; i < studentSkillsData.length; i++) {
            activeCombo.push(studentSkillsData[i]);
            getCombinations(i + 1, activeCombo);
            activeCombo.pop();
        }
    }
    getCombinations(0, []);

    // Helper function to evaluate how well a candidate subset fits the project requirements
    function evaluateTeam(teamCombo) {
        let coverageScore = 0; // how many requirements are met
        let totalProficiencyScore = 0;
        const roleAssignments = [];
        const assignedStudentIds = new Set();

        // For each role requirement, pick the best student in this team who matches it
        for (const req of requirements) {
            let bestCandidate = null;
            let bestScore = -1;

            for (const member of teamCombo) {
                const prof = member.skills[req.skill_id] || 0;
                if (prof >= req.min_proficiency) {
                    // Match score: direct proficiency level
                    if (prof > bestScore) {
                        bestScore = prof;
                        bestCandidate = member;
                    }
                }
            }

            // If no one meets the minimum, find the one with the highest proficiency (even if below minimum)
            if (!bestCandidate) {
                for (const member of teamCombo) {
                    const prof = member.skills[req.skill_id] || 0;
                    if (prof > bestScore) {
                        bestScore = prof;
                        bestCandidate = member;
                    }
                }
            }

            if (bestCandidate) {
                const met = (bestScore >= req.min_proficiency);
                coverageScore += met ? 1 : 0.5; // partial points for below min
                totalProficiencyScore += bestScore;
                
                roleAssignments.push({
                    roleName: req.role_name,
                    skillName: req.skill_name,
                    minProficiency: req.min_proficiency,
                    studentId: bestCandidate.student.id,
                    studentName: bestCandidate.student.name,
                    studentProficiency: bestScore,
                    isMet: met
                });
                assignedStudentIds.add(bestCandidate.student.id);
            }
        }

        // Synergy penalty: we want to use as many members of the team combo as possible.
        // If a 3-person team has 1 person doing all 3 roles and 2 people doing nothing, it's not a balanced team.
        const utilizationRate = assignedStudentIds.size / teamCombo.length;

        // Final score: coverage + average proficiency + utilization bonus
        const score = (coverageScore * 10) + (totalProficiencyScore * 2) + (utilizationRate * 5);

        return {
            score,
            team: teamCombo.map(m => m.student),
            assignments: roleAssignments,
            coverageRatio: Math.round((coverageScore / requirements.length) * 100)
        };
    }

    // 5. Evaluate all combinations and find the best one
    let bestTeamResult = null;
    let highestScore = -1;

    for (const combo of combinations) {
        const result = evaluateTeam(combo);
        if (result.score > highestScore) {
            highestScore = result.score;
            bestTeamResult = result;
        }
    }

    // In case there are not enough students or combinations, default to whatever we have
    if (!bestTeamResult && studentSkillsData.length > 0) {
        const subset = studentSkillsData.slice(0, teamSize);
        bestTeamResult = evaluateTeam(subset);
    }

    return bestTeamResult;
}

module.exports = {
    analyzeSkillGaps,
    buildLearningPath,
    formProjectTeam
};
