// Active State Management
let currentTab = 'dashboard';
let studentsList = [];
let careerRoles = [];
let projectsList = [];
let selectedStudentId = null;
let activeNetwork = null;
let consoleExpanded = false;
let lastLogCount = 0;
let academicChart = null;

// Quiz Assessment & Learning Progress State Variables
let currentAssessmentSkill = null;
let currentAssessmentQuestions = [];
let currentQuestionIndex = 0;
let assessmentScore = 0;
let userAnswers = [];
let learningState = {};

// Pre-defined sample resume text for easy testing
const sampleResumeData = {
    name: "Aisha Iyer",
    email: "aisha.iyer@engg.edu",
    githubUrl: "github.com/aishaiyer",
    source: "resume_upload",
    profileText: `OBJECTIVE:
Hardworking Computer Science student seeking a Backend Development or DevOps internship.

TECHNICAL SKILLS:
- Expert in Python, JavaScript, and Git version control.
- Proficient in Docker containerization and AWS cloud deployments.
- Familiar with PostgreSQL databases and Django web framework.

EXPERIENCE:
- Led a project team of 4 as Coordinator to build a cloud automation pipeline, showcasing strong Leadership and Teamwork.
- Solved complex database query bottlenecks using advanced Problem Solving and performance tuning.`
};

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    switchTab('dashboard');
    loadStudents();
    loadCareerRolesList();
    loadProjectsList();
    
    // Start database query polling
    pollDbLogs();
    setInterval(pollDbLogs, 1500);

    // Setup demo checkbox listener
    document.getElementById('ingest-demo-data').addEventListener('change', (e) => {
        const fileStar = document.getElementById('file-required-star');
        const fileInput = document.getElementById('ingest-file');
        const dropzone = document.getElementById('resume-dropzone');
        const fileInfo = document.getElementById('dropzone-file-name');
        
        if (e.target.checked) {
            document.getElementById('ingest-name').value = sampleResumeData.name;
            document.getElementById('ingest-email').value = sampleResumeData.email;
            document.getElementById('ingest-github').value = sampleResumeData.githubUrl;
            document.getElementById('ingest-source').value = sampleResumeData.source;
            fileInput.required = false;
            if (fileStar) fileStar.style.display = 'none';
            if (dropzone) dropzone.classList.remove('file-selected');
            if (fileInfo) fileInfo.textContent = "Supports PDF format (Max 5MB)";
            fileInput.value = '';
        } else {
            document.getElementById('ingest-name').value = '';
            document.getElementById('ingest-email').value = '';
            document.getElementById('ingest-github').value = '';
            fileInput.required = true;
            if (fileStar) fileStar.style.display = 'inline';
            if (dropzone) dropzone.classList.remove('file-selected');
            if (fileInfo) fileInfo.textContent = "Supports PDF format (Max 5MB)";
            fileInput.value = '';
        }
    });

    // Setup Drag & Drop Ingestion Dropzone
    const dropzone = document.getElementById('resume-dropzone');
    const fileInput = document.getElementById('ingest-file');
    const fileInfo = document.getElementById('dropzone-file-name');

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                fileInfo.textContent = `File selected: ${file.name} (${Math.round(file.size / 1024)} KB)`;
                dropzone.classList.add('file-selected');
                document.getElementById('ingest-demo-data').checked = false;
            } else {
                fileInfo.textContent = "Supports PDF format (Max 5MB)";
                dropzone.classList.remove('file-selected');
            }
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('dragover');
            }, false);
        });

        dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) {
                if (files[0].type === 'application/pdf' || files[0].name.toLowerCase().endsWith('.pdf')) {
                    fileInput.files = files;
                    fileInfo.textContent = `File dropped: ${files[0].name} (${Math.round(files[0].size / 1024)} KB)`;
                    dropzone.classList.add('file-selected');
                    document.getElementById('ingest-demo-data').checked = false;
                } else {
                    alert("Only PDF files are supported!");
                }
            }
        });
    }
});

// Switch Dashboard Tabs
function switchTab(tabId) {
    currentTab = tabId;
    
    // Update navigation button states
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`nav-${tabId}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Update visibility of views
    document.querySelectorAll('.tab-view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(`view-${tabId}`).classList.add('active');

    // Update headers
    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');
    
    if (tabId === 'dashboard') {
        titleEl.textContent = "Platform Dashboard";
        subtitleEl.textContent = "Overview of student profiles, aggregated skills, and database activity.";
    } else if (tabId === 'ingest') {
        titleEl.textContent = "Skill Ingestion Engine";
        subtitleEl.textContent = "Parse unstructured resumes or coding profiles into a structured graph.";
    } else if (tabId === 'graph') {
        titleEl.textContent = "Interactive Skill Graph";
        subtitleEl.textContent = "Explore relational mapping of skills, dependencies, and student proficiency.";
        loadStudentGraph();
    } else if (tabId === 'careers') {
        titleEl.textContent = "Career Path Planner";
        subtitleEl.textContent = "Analyze student compatibility and automatically trace a roadmap to bridge gaps.";
        loadCareerMatches();
    } else if (tabId === 'teams') {
        titleEl.textContent = "Balanced Team Builder";
        subtitleEl.textContent = "Form project teams by matching complementary tech and soft skill sets.";
    }
}

// Fetch Students Directory
async function loadStudents() {
    try {
        const res = await fetch('/api/students');
        studentsList = await res.json();
        
        // Update Stats
        document.getElementById('stat-students').textContent = studentsList.length;
        document.getElementById('student-count-badge').textContent = `${studentsList.length} Students`;
        
        // Render List
        renderStudentList(studentsList);
        
        // Populate Select Dropdowns
        populateDropdowns();

        // Fetch totals for taxonomy
        const skillsRes = await fetch('/api/skills');
        const skills = await skillsRes.json();
        document.getElementById('stat-skills').textContent = skills.length;
        
        // Sum total skills mapped (mock simple aggregate)
        let totalAssoc = 0;
        for (const s of studentsList) {
            const ssRes = await fetch(`/api/students/${s.id}/skills`);
            const ss = await ssRes.json();
            totalAssoc += ss.length;
        }
        document.getElementById('stat-edges').textContent = totalAssoc;

    } catch (e) {
        console.error("Failed to load students:", e);
    }
}

function renderStudentList(list) {
    const container = document.getElementById('student-list-container');
    container.innerHTML = '';
    
    if (list.length === 0) {
        container.innerHTML = '<div class="loading-placeholder">No students found.</div>';
        return;
    }
    
    list.forEach(student => {
        const card = document.createElement('div');
        card.className = `student-card ${selectedStudentId === student.id ? 'selected' : ''}`;
        card.id = `student-card-${student.id}`;
        card.onclick = () => selectStudent(student.id);
        
        card.innerHTML = `
            <div class="student-info-mini">
                <h4>${escapeHtml(student.name)}</h4>
                <p>${escapeHtml(student.email)}</p>
            </div>
            <i class="fa-solid fa-chevron-right card-chevron"></i>
        `;
        container.appendChild(card);
    });
}

function populateDropdowns() {
    const graphSelect = document.getElementById('graph-student-select');
    const careerSelect = document.getElementById('career-student-select');
    
    const prevGraphVal = graphSelect.value;
    const prevCareerVal = careerSelect.value;
    
    graphSelect.innerHTML = '<option value="">-- Select Student Node --</option>';
    careerSelect.innerHTML = '';
    
    studentsList.forEach(s => {
        const opt1 = `<option value="${s.id}">${escapeHtml(s.name)}</option>`;
        const opt2 = `<option value="${s.id}">${escapeHtml(s.name)}</option>`;
        graphSelect.insertAdjacentHTML('beforeend', opt1);
        careerSelect.insertAdjacentHTML('beforeend', opt2);
    });

    if (prevGraphVal && Array.from(graphSelect.options).some(o => o.value === prevGraphVal)) {
        graphSelect.value = prevGraphVal;
    }
    if (prevCareerVal && Array.from(careerSelect.options).some(o => o.value === prevCareerVal)) {
        careerSelect.value = prevCareerVal;
    }
}

// Select Student Profile
async function selectStudent(id) {
    selectedStudentId = id;
    
    // Highlight Card
    document.querySelectorAll('.student-card').forEach(card => card.classList.remove('selected'));
    const selectedCard = document.getElementById(`student-card-${id}`);
    if (selectedCard) selectedCard.classList.add('selected');

    document.getElementById('profile-unselected').classList.add('hidden');
    document.getElementById('profile-selected').classList.remove('hidden');

    try {
        // Fetch Details
        const resDetail = await fetch(`/api/students/${id}`);
        const student = await resDetail.json();
        
        document.getElementById('profile-name').textContent = student.name;
        document.getElementById('profile-email').textContent = student.email;
        
        const ghLink = document.getElementById('profile-github');
        if (student.github_url) {
            ghLink.href = student.github_url.startsWith('http') ? student.github_url : `https://${student.github_url}`;
            ghLink.classList.remove('hidden');
        } else {
            ghLink.classList.add('hidden');
        }

        // Fetch Skills Mappings
        const resSkills = await fetch(`/api/students/${id}/skills`);
        const skills = await resSkills.json();
        
        const chipsContainer = document.getElementById('profile-skills-chips');
        chipsContainer.innerHTML = '';
        
        if (skills.length === 0) {
            chipsContainer.innerHTML = '<p class="status-desc">No skills mapped yet. Ingest a profile to add skills.</p>';
            return;
        }

        // Sort skills by proficiency
        skills.sort((a, b) => b.proficiency - a.proficiency);

        skills.forEach(sk => {
            const chip = document.createElement('div');
            chip.className = `skill-chip lvl-${sk.proficiency}`;
            
            const isVerified = sk.source === 'assessment_verification';
            const verifyHtml = isVerified 
                ? `<span class="verified-badge-pill" style="color:var(--green); margin-left:6px;" title="Verified competency (Skill IQ)"><i class="fa-solid fa-circle-check"></i></span>`
                : `<button class="verify-badge-btn" onclick="event.stopPropagation(); startAssessment(${sk.skill_id}, '${escapeHtml(sk.name)}', ${sk.proficiency})" title="Take Skill IQ Verification Assessment"><i class="fa-regular fa-circle-check"></i></button>`;

            chip.innerHTML = `
                <span class="skill-level-dot"></span>
                <strong>${escapeHtml(sk.name)}</strong>
                <span>(Lvl ${sk.proficiency})</span>
                ${verifyHtml}
            `;
            chip.title = `Category: ${sk.category} | Source: ${sk.source} (${Math.round(sk.confidence_score * 100)}% Confidence)`;
            chipsContainer.appendChild(chip);
        });

        // Load academic progression chart
        await loadAcademicTrends(id);

    } catch (e) {
        console.error("Failed to load student profile details:", e);
    }
}

async function loadAcademicTrends(studentId) {
    try {
        const res = await fetch(`/api/students/${studentId}/academics`);
        const records = await res.json();

        const canvas = document.getElementById('academic-trends-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart if it exists
        if (academicChart) {
            academicChart.destroy();
            academicChart = null;
        }

        if (!records || records.length === 0) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.font = '14px Inter';
            ctx.fillStyle = '#94a3b8';
            ctx.textAlign = 'center';
            ctx.fillText('No academic records available for this student.', ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        // Sort records by semester to ensure correct chronological order
        records.sort((a, b) => a.semester.localeCompare(b.semester, undefined, { numeric: true, sensitivity: 'base' }));

        const labels = records.map(r => r.semester);
        const gpaData = records.map(r => parseFloat(r.gpa));
        const attendanceData = records.map(r => parseFloat(r.attendance));

        // Determine if GPA is 4.0 or 10.0 scale
        const maxGpaValue = Math.max(...gpaData);
        const gpaMax = maxGpaValue > 4.0 ? 10.0 : 4.0;

        academicChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'GPA',
                        data: gpaData,
                        borderColor: '#00e5ff',
                        backgroundColor: 'rgba(0, 229, 255, 0.05)',
                        borderWidth: 2,
                        pointBackgroundColor: '#00e5ff',
                        pointBorderColor: '#ffffff',
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        yAxisID: 'yGpa',
                        tension: 0.35
                    },
                    {
                        label: 'Attendance (%)',
                        data: attendanceData,
                        borderColor: '#a855f7',
                        backgroundColor: 'rgba(168, 85, 247, 0.05)',
                        borderWidth: 2,
                        pointBackgroundColor: '#a855f7',
                        pointBorderColor: '#ffffff',
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        yAxisID: 'yAttendance',
                        tension: 0.35
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#94a3b8',
                            font: {
                                family: 'Inter',
                                size: 11
                            },
                            boxWidth: 12
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#1e293b',
                        titleColor: '#ffffff',
                        bodyColor: '#e2e8f0',
                        borderColor: '#334155',
                        borderWidth: 1,
                        titleFont: { family: 'Outfit', weight: 'bold' },
                        bodyFont: { family: 'Inter' }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#94a3b8',
                            font: {
                                family: 'Inter',
                                size: 10
                            }
                        }
                    },
                    yGpa: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        min: 0,
                        max: gpaMax,
                        title: {
                            display: true,
                            text: 'GPA',
                            color: '#00e5ff',
                            font: {
                                family: 'Inter',
                                size: 10,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#94a3b8',
                            font: {
                                family: 'Inter',
                                size: 10
                            }
                        }
                    },
                    yAttendance: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        min: 0,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Attendance %',
                            color: '#a855f7',
                            font: {
                                family: 'Inter',
                                size: 10,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            color: '#94a3b8',
                            font: {
                                family: 'Inter',
                                size: 10
                            }
                        }
                    }
                }
            }
        });
    } catch (err) {
        console.error("Failed to load academic trends chart:", err);
    }
}

// Ingestion Handler
async function handleIngest(event) {
    event.preventDefault();
    
    const submitBtn = document.getElementById('ingest-submit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ingesting & Analyzing...';
    
    const name = document.getElementById('ingest-name').value;
    const email = document.getElementById('ingest-email').value;
    const githubUrl = document.getElementById('ingest-github').value;
    const source = document.getElementById('ingest-source').value;
    const isDemoChecked = document.getElementById('ingest-demo-data').checked;
    const fileInput = document.getElementById('ingest-file');

    try {
        // Use FormData for multipart/form-data PDF upload
        const formData = new FormData();
        formData.append('name', name);
        formData.append('email', email);
        formData.append('githubUrl', githubUrl);
        formData.append('source', source);

        if (isDemoChecked) {
            // Send default text directly if demo loaded
            formData.append('profileText', sampleResumeData.profileText);
        } else if (fileInput.files.length > 0) {
            formData.append('resume', fileInput.files[0]);
        } else {
            alert("Please select a PDF file to upload.");
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-microchip"></i> Parse & Save into ShaktiDB';
            return;
        }

        const res = await fetch('/api/students/ingest', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        
        if (data.error) {
            alert("Parsing failed: " + data.error);
            return;
        }

        // Show Success Feedback
        document.getElementById('feedback-empty').classList.add('hidden');
        const feedbackSuccess = document.getElementById('feedback-success');
        feedbackSuccess.classList.remove('hidden');
        
        document.getElementById('feedback-student-meta').textContent = `${data.student.name} (${data.student.email})`;
        
        const tableBody = document.getElementById('parsed-skills-body');
        tableBody.innerHTML = '';
        
        if (data.skillsExtracted.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No skills matched the taxonomy database.</td></tr>';
        } else {
            data.skillsExtracted.forEach(sk => {
                tableBody.insertAdjacentHTML('beforeend', `
                    <tr>
                        <td><strong>${escapeHtml(sk.name)}</strong></td>
                        <td><span class="skill-level-dot" style="display:inline-block; margin-right:6px; background-color: ${sk.proficiency >= 4 ? 'var(--green)' : 'var(--primary)'}"></span> Level ${sk.proficiency}</td>
                        <td>${Math.round(sk.confidence * 100)}%</td>
                        <td><span class="badge" style="font-size:10px">${escapeHtml(sk.source)}</span></td>
                    </tr>
                `);
            });
        }

        // Cache created student ID
        selectedStudentId = data.student.id;
        
        // Reload directory
        await loadStudents();

    } catch (e) {
        console.error(e);
        alert("Server communication error occurred during parsing.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-microchip"></i> Parse & Save into ShaktiDB';
        // Uncheck demo box
        document.getElementById('ingest-demo-data').checked = false;
    }
}

// Redirects from Dashboard to Graph / Careers tabs
function viewStudentGraph() {
    if (!selectedStudentId) return;
    document.getElementById('graph-student-select').value = selectedStudentId;
    switchTab('graph');
}

function viewCareerMatch() {
    if (!selectedStudentId) return;
    document.getElementById('career-student-select').value = selectedStudentId;
    switchTab('careers');
}

function viewIngestedStudentGraph() {
    if (!selectedStudentId) return;
    document.getElementById('graph-student-select').value = selectedStudentId;
    switchTab('graph');
}

// Delete Profile
async function deleteStudentProfile() {
    if (!selectedStudentId) return;
    if (!confirm("Are you sure you want to delete this student and all their skill associations from ShaktiDB?")) return;
    
    try {
        await fetch(`/api/students/${selectedStudentId}`, { method: 'DELETE' });
        selectedStudentId = null;
        document.getElementById('profile-selected').classList.add('hidden');
        document.getElementById('profile-unselected').classList.remove('hidden');
        loadStudents();
    } catch (e) {
        console.error("Delete profile failed:", e);
    }
}

// Filter Directory List
function filterStudents() {
    const query = document.getElementById('student-search').value.toLowerCase().trim();
    if (!query) {
        renderStudentList(studentsList);
        return;
    }
    const filtered = studentsList.filter(s => {
        return s.name.toLowerCase().includes(query) || s.email.toLowerCase().includes(query);
    });
    renderStudentList(filtered);
}

// Fetch Graph Network Nodes/Edges
async function loadStudentGraph() {
    const studentSelect = document.getElementById('graph-student-select');
    const studentId = studentSelect.value;
    
    const canvas = document.getElementById('skill-network-canvas');
    
    if (!studentId) {
        canvas.innerHTML = '<div class="profile-placeholder"><h3>Select a Student Node</h3><p>Choose a student from the dropdown above to display their personal skill graph network.</p></div>';
        return;
    }

    canvas.innerHTML = '<div class="loading-placeholder"><i class="fa-solid fa-spinner fa-spin"></i> Rendering network graph...</div>';

    try {
        // Fetch student details
        const studentRes = await fetch(`/api/students/${studentId}`);
        const student = await studentRes.json();

        // Fetch skills mapped to student
        const skillsRes = await fetch(`/api/students/${studentId}/skills`);
        const studentSkills = await skillsRes.json();

        // Fetch all skill dependencies to map prerequisites
        const depRes = await fetch('/api/skill-dependencies');
        const dependencies = await depRes.json();

        const nodesList = [];
        const edgesList = [];

        // 1. Center Student Node
        nodesList.push({
            id: 'student_' + student.id,
            label: student.name,
            shape: 'dot',
            size: 26,
            color: {
                background: '#080c16',
                border: '#00e5ff',
                highlight: { background: '#080c16', border: '#00e5ff' }
            },
            font: { color: '#ffffff', face: 'Outfit', size: 16, bold: true },
            borderWidth: 3,
            shadow: { enabled: true, color: 'rgba(0,229,255,0.4)', size: 10 }
        });

        // Track categories to create category hub nodes
        const categories = [...new Set(studentSkills.map(sk => sk.category))];
        const categoryColors = {
            "Programming Languages": "#9f3df5",
            "Web Frameworks": "#f1c40f",
            "Databases": "#2ecc71",
            "Cloud & DevOps": "#e67e22",
            "Soft Skills": "#e74c3c"
        };

        // 2. Add Category Nodes
        categories.forEach(cat => {
            const catId = 'cat_' + cat.replace(/\s+/g, '_');
            const color = categoryColors[cat] || '#7f8c8d';
            
            nodesList.push({
                id: catId,
                label: cat,
                shape: 'dot',
                size: 18,
                color: {
                    background: color,
                    border: 'rgba(255,255,255,0.2)',
                    highlight: { background: color, border: '#ffffff' }
                },
                font: { color: '#a1b0cb', face: 'Inter', size: 12 },
                borderWidth: 1
            });

            // Edge from Student to Category
            edgesList.push({
                from: 'student_' + student.id,
                to: catId,
                color: { color: 'rgba(255,255,255,0.15)' },
                width: 1.5,
                dashes: true
            });
        });

        // 3. Add Skill Nodes
        studentSkills.forEach(sk => {
            const catId = 'cat_' + sk.category.replace(/\s+/g, '_');
            const skillNodeId = 'skill_' + sk.skill_id;
            const catColor = categoryColors[sk.category] || '#7f8c8d';
            
            nodesList.push({
                id: skillNodeId,
                label: `${sk.name}\n(Lvl ${sk.proficiency})`,
                shape: 'dot',
                size: 14,
                color: {
                    background: '#0d1426',
                    border: catColor,
                    highlight: { background: '#1a284d', border: '#ffffff' }
                },
                font: { color: '#f0f3fa', face: 'Inter', size: 11 },
                borderWidth: 2,
                title: `Skill: ${sk.name}<br>Proficiency: ${sk.proficiency}/5<br>Confidence: ${Math.round(sk.confidence_score * 100)}%<br>Source: ${sk.source}`
            });

            // Edge from Category Hub to Skill
            edgesList.push({
                from: catId,
                to: skillNodeId,
                color: { color: catColor, opacity: 0.5 },
                width: sk.proficiency * 1.5 // edge thickness scales with skill proficiency!
            });
        });

        // 4. Add Prerequisite/Dependency links (only between skills the student actually has)
        const studentSkillIds = new Set(studentSkills.map(sk => sk.skill_id));
        dependencies.forEach(dep => {
            if (studentSkillIds.has(dep.parent_skill_id) && studentSkillIds.has(dep.child_skill_id)) {
                edgesList.push({
                    from: 'skill_' + dep.parent_skill_id,
                    to: 'skill_' + dep.child_skill_id,
                    arrows: 'to',
                    color: { color: 'rgba(255, 56, 96, 0.4)' },
                    width: 2,
                    dashes: true,
                    label: 'requires',
                    font: { size: 9, fill: 'none', color: '#ff3860' }
                });
            }
        });

        // Initialize Vis.js Network
        canvas.innerHTML = ''; // clear placeholder
        const data = { nodes: new vis.DataSet(nodesList), edges: new vis.DataSet(edgesList) };
        
        const options = {
            physics: {
                barnesHut: {
                    gravitationalConstant: -3000,
                    centralGravity: 0.3,
                    springLength: 95,
                    springConstant: 0.04
                },
                solver: 'barnesHut'
            },
            interaction: {
                hover: true,
                tooltipDelay: 100
            }
        };
        
        activeNetwork = new vis.Network(canvas, data, options);

        // Bind selection event listeners for detail drawer overlay
        activeNetwork.on("selectNode", async (params) => {
            if (params.nodes.length === 0) return;
            const nodeId = params.nodes[0];
            const drawer = document.getElementById('graph-node-drawer');
            const drawerContent = document.getElementById('node-drawer-content');
            
            if (drawer) drawer.classList.remove('hidden');
            if (drawerContent) drawerContent.innerHTML = '<div class="loading-placeholder"><i class="fa-solid fa-spinner fa-spin"></i> Loading details...</div>';
            
            try {
                if (nodeId.startsWith('student_')) {
                    drawerContent.innerHTML = `
                        <div class="drawer-title">Student Profile</div>
                        <div class="drawer-desc" style="margin-top: 10px;">
                            <strong style="color:var(--cyan)">Name:</strong> ${escapeHtml(student.name)}<br>
                            <strong style="color:var(--cyan)">Email:</strong> ${escapeHtml(student.email)}<br>
                            <strong style="color:var(--cyan)">GitHub:</strong> ${student.github_url ? `<a href="https://${student.github_url}" target="_blank" style="color:var(--text-main); text-decoration:underline">${escapeHtml(student.github_url)}</a>` : 'Not linked'}<br>
                        </div>
                        <div style="margin-top: 20px;">
                            <div class="drawer-section-title">Mapped Skills</div>
                            <div class="drawer-stat">${studentSkills.length} Nodes</div>
                        </div>
                    `;
                } else if (nodeId.startsWith('cat_')) {
                    const catName = nodeId.substring(4).replace(/_/g, ' ');
                    const catSkills = studentSkills.filter(sk => sk.category === catName);
                    
                    drawerContent.innerHTML = `
                        <div class="drawer-title">${escapeHtml(catName)}</div>
                        <div class="drawer-desc" style="margin-top: 10px;">Category grouping hub for skills mapped to this student.</div>
                        <div style="margin-top: 20px;">
                            <div class="drawer-section-title">Associated Skills</div>
                            <div class="drawer-list">
                                ${catSkills.map(sk => `
                                    <div class="drawer-list-item">
                                        <span>${escapeHtml(sk.name)}</span>
                                        <span class="badge" style="color:var(--cyan)">Level ${sk.proficiency}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                } else if (nodeId.startsWith('skill_')) {
                    const skillId = parseInt(nodeId.substring(6));
                    const skillMatch = studentSkills.find(sk => sk.skill_id === skillId);
                    
                    if (!skillMatch) {
                        drawerContent.innerHTML = '<div class="drawer-desc">Skill node selected.</div>';
                        return;
                    }

                    // Query other students who share this skill
                    const peerStudents = [];
                    for (const s of studentsList) {
                        if (s.id === student.id) continue;
                        const sSkillsRes = await fetch(`/api/students/${s.id}/skills`);
                        const sSkills = await sSkillsRes.json();
                        const sMatch = sSkills.find(sk => sk.skill_id === skillId);
                        if (sMatch) {
                            peerStudents.push({ name: s.name, proficiency: sMatch.proficiency });
                        }
                    }

                    drawerContent.innerHTML = `
                        <div class="drawer-title">${escapeHtml(skillMatch.name)}</div>
                        <div style="margin-top: 10px;">
                            <div class="drawer-section-title">Category</div>
                            <div class="drawer-desc">${escapeHtml(skillMatch.category)}</div>
                        </div>
                        <div style="margin-top: 15px;">
                            <div class="drawer-section-title">Student Competency</div>
                            <div class="drawer-stat">Level ${skillMatch.proficiency} / 5</div>
                            <div class="drawer-desc" style="margin-top: 4px; font-size:11px">
                                Confidence: ${Math.round(skillMatch.confidence_score * 100)}% (${escapeHtml(skillMatch.source)})
                            </div>
                            ${skillMatch.source !== 'assessment_verification' ? `
                                <button class="path-action-btn" onclick="closeNodeDrawer(); startAssessment(${skillMatch.skill_id}, '${escapeHtml(skillMatch.name)}', ${skillMatch.proficiency})" style="margin-top:8px;">
                                    <i class="fa-solid fa-circle-check"></i> Verify Competency
                                </button>
                            ` : `
                                <div style="color:var(--green); font-size:12px; margin-top:8px; display:flex; align-items:center; gap:6px;">
                                    <i class="fa-solid fa-circle-check"></i> Verified (Skill IQ)
                                </div>
                            `}
                        </div>
                        <div style="margin-top: 15px;">
                            <div class="drawer-section-title">Description</div>
                            <div class="drawer-desc">${escapeHtml(skillMatch.description || 'No description available.')}</div>
                        </div>
                        <div style="margin-top: 20px;">
                            <div class="drawer-section-title">Peers Sharing This Skill</div>
                            <div class="drawer-list">
                                ${peerStudents.length === 0 ? '<div class="drawer-desc" style="font-size:11px">No other students share this skill.</div>' : 
                                  peerStudents.map(p => `
                                    <div class="drawer-list-item">
                                        <span>${escapeHtml(p.name)}</span>
                                        <span class="badge" style="color:var(--green)">Level ${p.proficiency}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }
            } catch (err) {
                drawerContent.innerHTML = `<div class="drawer-desc" style="color:var(--red)">Failed to load details: ${err.message}</div>`;
            }
        });

        activeNetwork.on("deselectNode", (params) => {
            closeNodeDrawer();
        });

    } catch (e) {
        console.error("Failed to render Vis.js network:", e);
        canvas.innerHTML = '<div class="loading-placeholder" style="color:var(--red);">Error rendering graph network: ' + e.message + '</div>';
    }
}

// Career Matching & Gap Analysis
async function loadCareerRolesList() {
    try {
        const res = await fetch('/api/career-roles');
        careerRoles = await res.json();
        
        const container = document.getElementById('career-roles-container');
        container.innerHTML = '';
        
        careerRoles.forEach((role, idx) => {
            const item = document.createElement('div');
            item.className = `career-role-item ${idx === 0 ? 'selected' : ''}`;
            item.id = `career-role-${role.id}`;
            item.onclick = () => selectCareerRole(role.id);
            item.innerHTML = `
                <h4>${escapeHtml(role.title)}</h4>
            `;
            container.appendChild(item);
        });

    } catch (e) {
        console.error(e);
    }
}

async function loadCareerMatches() {
    const studentId = document.getElementById('career-student-select').value;
    
    // Clear display if no student
    if (!studentId) {
        document.getElementById('career-selected').classList.add('hidden');
        document.getElementById('career-unselected').classList.remove('hidden');
        return;
    }

    // Default to first role selected
    const selectedRoleEl = document.querySelector('.career-role-item.selected');
    const roleId = selectedRoleEl ? parseInt(selectedRoleEl.id.split('-').pop()) : (careerRoles[0] ? careerRoles[0].id : null);
    
    if (roleId) {
        selectCareerRole(roleId);
    }
}

async function selectCareerRole(roleId) {
    const studentId = document.getElementById('career-student-select').value;
    if (!studentId) return;

    // Highlight role item
    document.querySelectorAll('.career-role-item').forEach(item => item.classList.remove('selected'));
    const item = document.getElementById(`career-role-${roleId}`);
    if (item) item.classList.add('selected');

    document.getElementById('career-unselected').classList.add('hidden');
    document.getElementById('career-selected').classList.remove('hidden');

    try {
        // Fetch career gap analysis from server
        const res = await fetch(`/api/students/${studentId}/gap-analysis`);
        const allMatches = await res.json();
        
        const match = allMatches.find(m => m.roleId === roleId);
        if (!match) return;

        // Render header
        document.getElementById('career-title').textContent = match.roleTitle;
        document.getElementById('career-desc').textContent = match.description;
        
        const matchVal = document.getElementById('career-match-val');
        matchVal.textContent = `${match.matchPercentage}%`;
        
        // Color match score based on rating
        if (match.matchPercentage >= 80) {
            matchVal.style.color = 'var(--green)';
        } else if (match.matchPercentage >= 50) {
            matchVal.style.color = 'var(--cyan)';
        } else {
            matchVal.style.color = 'var(--primary)';
        }

        // Render skill gap matrix
        const gapList = document.getElementById('gap-skills-list');
        gapList.innerHTML = '';
        
        match.details.forEach(sk => {
            const row = document.createElement('div');
            row.className = 'gap-item';
            
            let statusText = 'Met';
            if (sk.status === 'gap') statusText = `Gap (Needs +${sk.gap})`;
            if (sk.status === 'missing') statusText = 'Missing';
            
            row.innerHTML = `
                <div class="gap-skill-info">
                    <h5>${escapeHtml(sk.skillName)}</h5>
                    <span>Category: ${sk.category} | Yours: Lvl ${sk.studentProficiency} / Target: Lvl ${sk.requiredProficiency}</span>
                </div>
                <span class="gap-status-badge ${sk.status}">${statusText}</span>
            `;
            gapList.appendChild(row);
        });

        // Fetch recursive learning path
        const pathRes = await fetch(`/api/students/${studentId}/learning-path/${roleId}`);
        const pathSteps = await pathRes.json();
        
        const stepsContainer = document.getElementById('learning-path-steps');
        stepsContainer.innerHTML = '';

        if (pathSteps.length === 0) {
            stepsContainer.innerHTML = `
                <div class="success-banner" style="background: rgba(28,209,117,0.06); border: 1px solid rgba(28,209,117,0.15)">
                    <i class="fa-solid fa-circle-check" style="color:var(--green)"></i>
                    <p style="font-size:12px; margin:0">You meet all required skill levels for this role! No learning path needed.</p>
                </div>
            `;
            return;
        }

        pathSteps.forEach((step, idx) => {
            const isPrereq = step.type === 'Prerequisite';
            
            const resourcesHtml = step.resources && step.resources.length > 0 ? `
                <div class="step-resources" style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px;">
                    <span style="font-size:11px; font-weight:600; color:var(--text-muted); display:block; width:100%;">Curated Learning Resources:</span>
                    ${step.resources.map(res => `
                        <a href="${escapeHtml(res.url)}" target="_blank" class="resource-pill" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 12px; font-size: 11px; color: var(--cyan); text-decoration: none; transition: var(--transition-fast);" onmouseover="this.style.background='rgba(0,229,255,0.08)'; this.style.borderColor='var(--cyan)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'; this.style.borderColor='var(--border-color)'">
                            <i class="fa-solid fa-graduation-cap"></i>
                            <span>${escapeHtml(res.title)} (${escapeHtml(res.platform)})</span>
                        </a>
                    `).join('')}
                </div>
            ` : '';

            // Check tracking state
            const stateKey = `${selectedStudentId}_${step.skillId}`;
            const currentStatus = learningState[stateKey] || 'not_started';
            
            const progressButtonsHtml = `
                <div class="step-progress-actions" style="margin-top: 10px; display: flex; gap: 8px;">
                    <button class="path-action-btn ${currentStatus === 'inprogress' ? 'active-inprogress' : ''}" id="btn-learn-${step.skillId}" onclick="toggleLearningProgress(${step.skillId})">
                        <i class="fa-solid fa-book-open"></i> ${currentStatus === 'inprogress' ? 'In Progress' : 'Start Learning'}
                    </button>
                    <button class="path-action-btn ${currentStatus === 'completed' ? 'active-completed' : ''}" id="btn-complete-${step.skillId}" onclick="completeLearningStep(${step.skillId}, '${escapeHtml(step.skillName)}', ${step.targetProficiency})">
                        <i class="fa-solid fa-check"></i> ${currentStatus === 'completed' ? 'Completed' : 'Mark Completed'}
                    </button>
                </div>
            `;

            stepsContainer.insertAdjacentHTML('beforeend', `
                <div class="step-node ${isPrereq ? 'prereq' : ''} ${currentStatus}" id="step-node-${step.skillId}">
                    <div class="step-marker"></div>
                    <div class="step-content">
                        <div class="step-title">
                            <strong>Step ${idx + 1}: Master ${escapeHtml(step.skillName)}</strong>
                            <span class="step-badge">${step.type}</span>
                        </div>
                        <p class="step-desc">${escapeHtml(step.reason)} (Target: Level ${step.targetProficiency})</p>
                        ${resourcesHtml}
                        ${progressButtonsHtml}
                    </div>
                </div>
            `);
        });

    } catch (e) {
        console.error(e);
    }
}

// Project Team Assembly Engine
async function loadProjectsList() {
    try {
        const res = await fetch('/api/projects');
        projectsList = await res.json();
        
        const container = document.getElementById('projects-container');
        container.innerHTML = '';
        
        projectsList.forEach((proj, idx) => {
            const item = document.createElement('div');
            item.className = 'project-item';
            item.id = `project-item-${proj.id}`;
            item.onclick = () => selectProject(proj.id);
            item.innerHTML = `
                <h4>${escapeHtml(proj.title)}</h4>
                <p style="font-size:11px; color:var(--text-muted); margin-top:4px">Target Size: ${proj.required_team_size} members</p>
            `;
            container.appendChild(item);
        });

    } catch (e) {
        console.error(e);
    }
}

async function selectProject(projectId) {
    document.querySelectorAll('.project-item').forEach(item => item.classList.remove('selected'));
    const item = document.getElementById(`project-item-${projectId}`);
    if (item) item.classList.add('selected');

    document.getElementById('team-unselected').classList.add('hidden');
    
    const resultsContainer = document.getElementById('team-selected');
    resultsContainer.classList.add('hidden');

    try {
        // Trigger Team Formation API
        const res = await fetch(`/api/projects/${projectId}/form-team`);
        const result = await res.json();

        if (result.error) {
            alert("Team assembly error: " + result.error);
            return;
        }

        const project = projectsList.find(p => p.id === projectId);
        document.getElementById('project-title').textContent = project.title;
        document.getElementById('project-desc').textContent = project.description;
        document.getElementById('team-coverage-val').textContent = `${result.coverageRatio}%`;
        
        // Render Team Members
        const membersList = document.getElementById('team-members-list');
        membersList.innerHTML = '';
        
        result.team.forEach(student => {
            membersList.insertAdjacentHTML('beforeend', `
                <div class="team-member-card">
                    <div class="member-icon"><i class="fa-solid fa-user-astronaut"></i></div>
                    <div class="member-meta">
                        <h5>${escapeHtml(student.name)}</h5>
                        <span>${escapeHtml(student.email)}</span>
                    </div>
                </div>
            `);
        });

        // Render Role Assignments
        const assignmentsList = document.getElementById('team-assignments-list');
        assignmentsList.innerHTML = '';
        
        result.assignments.forEach(assign => {
            const badgeText = assign.isMet ? 'Meets Requirement' : 'Under-qualified';
            const badgeColor = assign.isMet ? 'rgba(28, 209, 117, 0.1)' : 'rgba(255, 56, 96, 0.1)';
            const borderStyle = assign.isMet ? 'border-color: rgba(28, 209, 117, 0.2)' : 'border-color: rgba(255, 56, 96, 0.2)';
            
            assignmentsList.insertAdjacentHTML('beforeend', `
                <div class="assignment-card" style="${borderStyle}">
                    <div class="assignment-header">
                        <h5>${escapeHtml(assign.roleName)}</h5>
                        <span style="background:${badgeColor}; color: ${assign.isMet ? 'var(--green)' : 'var(--red)'}">${badgeText}</span>
                    </div>
                    <div class="assignment-detail">
                        Assigned: <strong>${escapeHtml(assign.studentName)}</strong><br>
                        Prerequisite: ${escapeHtml(assign.skillName)} (Required: Lvl ${assign.minProficiency} / Member: Lvl ${assign.studentProficiency})
                    </div>
                </div>
            `);
        });

        resultsContainer.classList.remove('hidden');

    } catch (e) {
        console.error(e);
        alert("Failed to form team. Ensure there are seeded students in the database.");
    }
}

// Database Console & SQL Logger
function toggleConsole() {
    const consoleEl = document.querySelector('.db-console');
    consoleExpanded = !consoleExpanded;
    
    if (consoleExpanded) {
        consoleEl.classList.add('expanded');
    } else {
        consoleEl.classList.remove('expanded');
    }
}

async function pollDbLogs() {
    try {
        const res = await fetch('/api/db/logs');
        const data = await res.json();
        
        // Update Indicator
        const indicator = document.getElementById('db-indicator');
        const desc = document.getElementById('db-desc');
        const consoleStatus = document.getElementById('console-status-text');

        if (data.isMock) {
            indicator.textContent = "Mock Mode";
            indicator.className = "status-indicator";
            desc.textContent = "Running in zero-dependency SQL emulation database mode.";
            consoleStatus.textContent = "EMULATION MODE";
            consoleStatus.style.color = "var(--text-muted)";
        } else {
            indicator.textContent = "Connected";
            indicator.className = "status-indicator connected";
            desc.textContent = "Direct SQL connection to ShaktiDB (PostgreSQL) active.";
            consoleStatus.textContent = "SHAKTIDB LIVE";
            consoleStatus.style.color = "var(--green)";
        }

        // Render new console logs
        if (data.logs.length > lastLogCount) {
            const consoleBody = document.getElementById('console-log-body');
            
            // Append new rows
            for (let i = lastLogCount; i < data.logs.length; i++) {
                const logLine = data.logs[i];
                const row = document.createElement('div');
                row.className = 'console-row';
                
                // Colorize SQL syntax keywords for visual pop
                row.innerHTML = colorizeSql(logLine);
                consoleBody.appendChild(row);
            }
            
            lastLogCount = data.logs.length;
            
            // Auto scroll console
            consoleBody.scrollTop = consoleBody.scrollHeight;
        }

    } catch (e) {
        console.error("Poller failed:", e);
    }
}

async function clearDbLogs() {
    try {
        await fetch('/api/db/logs/clear', { method: 'POST' });
        document.getElementById('console-log-body').innerHTML = '';
        lastLogCount = 0;
    } catch (e) {
        console.error(e);
    }
}

function colorizeSql(text) {
    // Basic regex styling for SQL console presentation
    let html = escapeHtml(text);
    
    // Highlight timestamps: [10:30:15]
    html = html.replace(/^(\[\d{1,2}:\d{2}:\d{2}\])/, '<span style="color:#7585a1">$1</span>');
    
    // Highlight parameters section
    html = html.replace(/(\| Params:.*)$/, '<span style="color:var(--cyan)">$1</span>');
    
    // Highlight key SQL commands
    const sqlKeywords = [
        /\bSELECT\b/g, /\bFROM\b/g, /\bWHERE\b/g, /\bINSERT INTO\b/g, 
        /\bVALUES\b/g, /\bUPDATE\b/g, /\bDELETE\b/g, /\bJOIN\b/g, 
        /\bON\b/g, /\bCREATE TABLE\b/g, /\bON CONFLICT\b/g, /\bDO UPDATE SET\b/g
    ];
    
    sqlKeywords.forEach(kw => {
        html = html.replace(kw, match => `<span style="color:#ffffff; font-weight:bold">${match}</span>`);
    });
    
    return html;
}

// Utility Helpers
function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function closeNodeDrawer() {
    const drawer = document.getElementById('graph-node-drawer');
    if (drawer) drawer.classList.add('hidden');
    if (activeNetwork) activeNetwork.unselectNodes();
}

// Pluralsight Style Skill IQ Assessment Functions
function getFallbackQuestions(skillName) {
    return [
        {
            question: `What is a primary use case or characteristic of ${skillName}?`,
            options: [
                `To build scalable applications and improve development workflow in its domain.`,
                `To design hardware chips.`,
                `It is a replacement for operating system kernels.`,
                `None of the above.`
            ],
            answer_idx: 0
        },
        {
            question: `Which of the following is considered a best practice when working with ${skillName}?`,
            options: [
                `Writing code without any documentation or version history.`,
                `Writing modular, testable code and following established community style guidelines.`,
                `Storing secrets and passwords directly in open source git files.`,
                `Hardcoding all properties instead of using config files.`
            ],
            answer_idx: 1
        },
        {
            question: `How does intermediate level knowledge of ${skillName} benefit a developer?`,
            options: [
                `It guarantees database indexing is turned off.`,
                `It allows designing complex architectures, optimizing code performance, and resolving standard debugging issues.`,
                `It enables writing scripts that bypass all network protocols.`,
                `It has no practical benefits.`
            ],
            answer_idx: 1
        }
    ];
}

async function startAssessment(skillId, skillName, currentProficiency) {
    if (!selectedStudentId) {
        alert("Please select a student profile first!");
        return;
    }
    
    currentAssessmentSkill = { id: skillId, name: skillName, proficiency: currentProficiency || 3 };
    currentQuestionIndex = 0;
    assessmentScore = 0;
    userAnswers = [];

    // Open Modal
    const modal = document.getElementById('assessment-modal');
    if (modal) modal.classList.remove('hidden');

    document.getElementById('assessment-skill-title').textContent = `${skillName} Skill IQ Assessment`;
    document.getElementById('assessment-question-view').classList.remove('hidden');
    document.getElementById('assessment-result-view').classList.add('hidden');

    try {
        const res = await fetch(`/api/skills/${skillId}/questions`);
        let questions = await res.json();
        
        if (!questions || questions.length === 0) {
            questions = getFallbackQuestions(skillName);
        }
        
        currentAssessmentQuestions = questions;
        renderQuestion();
    } catch (e) {
        console.error("Failed to load quiz questions, falling back:", e);
        currentAssessmentQuestions = getFallbackQuestions(skillName);
        renderQuestion();
    }
}

function renderQuestion() {
    if (currentQuestionIndex >= currentAssessmentQuestions.length) {
        showScorecard();
        return;
    }

    const q = currentAssessmentQuestions[currentQuestionIndex];
    document.getElementById('assessment-progress-fill').style.width = `${((currentQuestionIndex + 1) / currentAssessmentQuestions.length) * 100}%`;
    document.getElementById('assessment-question-num').textContent = `Question ${currentQuestionIndex + 1} of ${currentAssessmentQuestions.length}`;
    document.getElementById('assessment-question-text').textContent = q.question;

    const container = document.getElementById('assessment-options-container');
    container.innerHTML = '';

    q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opt;
        btn.onclick = () => handleAnswerSelection(idx, btn);
        container.appendChild(btn);
    });
}

function handleAnswerSelection(selectedIdx, buttonEl) {
    const q = currentAssessmentQuestions[currentQuestionIndex];
    const buttons = document.querySelectorAll('#assessment-options-container .option-btn');
    
    // Disable all options
    buttons.forEach(btn => btn.disabled = true);
    
    if (selectedIdx === q.answer_idx) {
        buttonEl.classList.add('correct');
        assessmentScore++;
    } else {
        buttonEl.classList.add('incorrect');
        buttons[q.answer_idx].classList.add('correct');
    }

    userAnswers.push(selectedIdx);

    setTimeout(() => {
        currentQuestionIndex++;
        renderQuestion();
    }, 1200);
}

async function showScorecard() {
    document.getElementById('assessment-question-view').classList.add('hidden');
    document.getElementById('assessment-result-view').classList.remove('hidden');

    const totalQ = currentAssessmentQuestions.length;
    document.getElementById('assessment-score-val').textContent = `${assessmentScore} / ${totalQ}`;
    
    // Calculate new proficiency level based on score
    let newLevel = currentAssessmentSkill.proficiency;
    if (assessmentScore === totalQ) {
        newLevel = Math.min(5, newLevel + 1);
    } else if (assessmentScore === 2) {
        newLevel = Math.max(3, newLevel);
    } else {
        newLevel = Math.max(2, newLevel - 1);
    }

    document.getElementById('assessment-level-val').textContent = `Level ${newLevel}`;

    try {
        const res = await fetch(`/api/students/${selectedStudentId}/skills/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                skillId: currentAssessmentSkill.id,
                proficiency: newLevel,
                confidence: 1.0,
                source: 'assessment_verification'
            })
        });
        const data = await res.json();
        if (data.success) {
            await loadStudents();
            await selectStudent(selectedStudentId);
            if (currentTab === 'graph') {
                await loadStudentGraph();
            }
        }
    } catch (err) {
        console.error("Failed to submit verification assessment:", err);
    }
}

function closeAssessmentModal() {
    const modal = document.getElementById('assessment-modal');
    if (modal) modal.classList.add('hidden');
}

// Learning Path Progress Tracker Functions
function toggleLearningProgress(skillId) {
    const stateKey = `${selectedStudentId}_${skillId}`;
    const node = document.getElementById(`step-node-${skillId}`);
    const btn = document.getElementById(`btn-learn-${skillId}`);
    
    if (learningState[stateKey] === 'inprogress') {
        learningState[stateKey] = 'not_started';
        if (node) node.classList.remove('in-progress');
        if (btn) {
            btn.classList.remove('active-inprogress');
            btn.innerHTML = `<i class="fa-solid fa-book-open"></i> Start Learning`;
        }
    } else {
        learningState[stateKey] = 'inprogress';
        if (node) {
            node.classList.remove('completed');
            node.classList.add('in-progress');
        }
        if (btn) {
            btn.classList.add('active-inprogress');
            btn.innerHTML = `<i class="fa-solid fa-book-open"></i> In Progress`;
        }
        const btnComp = document.getElementById(`btn-complete-${skillId}`);
        if (btnComp) btnComp.classList.remove('active-completed');
    }
}

async function completeLearningStep(skillId, skillName, targetProficiency) {
    const stateKey = `${selectedStudentId}_${skillId}`;
    
    learningState[stateKey] = 'completed';
    const node = document.getElementById(`step-node-${skillId}`);
    if (node) {
        node.classList.remove('in-progress');
        node.classList.add('completed');
    }
    
    const btnComp = document.getElementById(`btn-complete-${skillId}`);
    if (btnComp) {
        btnComp.classList.add('active-completed');
        btnComp.innerHTML = `<i class="fa-solid fa-check"></i> Completed`;
    }
    const btnLearn = document.getElementById(`btn-learn-${skillId}`);
    if (btnLearn) {
        btnLearn.classList.remove('active-inprogress');
        btnLearn.innerHTML = `<i class="fa-solid fa-book-open"></i> Start Learning`;
    }

    try {
        const res = await fetch(`/api/students/${selectedStudentId}/skills/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                skillId: skillId,
                proficiency: targetProficiency,
                confidence: 1.0,
                source: 'assessment_verification'
            })
        });
        const data = await res.json();
        
        if (data.success) {
            await selectStudent(selectedStudentId);
            await viewCareerMatch();
        }
    } catch (err) {
        console.error("Failed to mark learning path step completed:", err);
    }
}
