const SKILL_KEYWORDS = {
    "JavaScript": [/javascript/i, /\bjs\b/i, /ecmascript/i, /node\.js/i, /nodejs/i],
    "Python": [/python/i, /\bpy\b/i, /django/i, /flask/i, /numpy/i, /pandas/i],
    "Java": [/java\b/i, /spring\b/i, /hibernate/i, /maven/i],
    "C++": [/c\+\+/i, /cpp/i],
    "Go": [/\bgo\b/i, /\bgolang\b/i],
    "React": [/react/i, /reactjs/i, /redux/i, /react-native/i],
    "Express": [/express/i, /expressjs/i],
    "Django": [/django/i],
    "Spring Boot": [/spring boot/i, /springboot/i],
    "PostgreSQL": [/postgres/i, /postgresql/i, /psql/i],
    "MongoDB": [/mongo/i, /mongodb/i],
    "ShaktiDB": [/shaktidb/i, /shakti db/i, /shakti-db/i],
    "Docker": [/docker/i, /docker-compose/i, /containerization/i],
    "AWS": [/aws\b/i, /amazon web services/i, /s3\b/i, /ec2\b/i],
    "Git": [/git\b/i, /github/i, /gitlab/i, /version control/i],
    "Leadership": [/lead/i, /managed team/i, /president/i, /founder/i, /guided/i, /leadership/i, /coordinator/i],
    "Communication": [/communication/i, /presentation/i, /public speaking/i, /written skills/i, /negotiation/i, /spoke/i],
    "Teamwork": [/teamwork/i, /collaboration/i, /collaborated/i, /team player/i, /cooperated/i, /co-ordinated/i],
    "Problem Solving": [/problem solving/i, /critical thinking/i, /analytical/i, /troubleshooting/i, /algorithms/i, /data structures/i]
};

// Heuristics for proficiency mapping
const PROFICIENCY_MODIFIERS = [
    { level: 5, keywords: [/expert/i, /advanced/i, /architect/i, /senior/i, /master/i, /5\+ years/i, /4\+ years/i] },
    { level: 4, keywords: [/proficient/i, /intermediate/i, /experienced/i, /3\+ years/i, /2\+ years/i, /built/i, /developed/i, /implemented/i] },
    { level: 3, keywords: [/familiar/i, /beginner/i, /knowledge of/i, /learned/i, /basic/i, /1\+ year/i, /academic/i, /exposure/i] }
];

/**
 * Extracts skills, proficiency, and confidence scores from profile text
 * @param {string} text - Raw text from resume, cert, or github profile
 * @param {string} source - 'resume_upload', 'github_profile', 'cert_verification'
 * @returns {Array} - List of extracted skill objects
 */
function parseProfile(text, source) {
    if (!text || typeof text !== 'string') return [];

    // Try parsing as structured JSON first, in case the user pasted a JSON API response
    try {
        const parsedJson = JSON.parse(text);
        if (parsedJson && (Array.isArray(parsedJson.skills) || typeof parsedJson.skills === 'object')) {
            const list = [];
            const skillsSource = Array.isArray(parsedJson.skills) ? parsedJson.skills : Object.keys(parsedJson.skills);
            for (const item of skillsSource) {
                let name = '';
                let proficiency = 3;
                let confidence = 0.85;
                if (typeof item === 'string') {
                    name = item;
                } else if (typeof item === 'object') {
                    name = item.name || item.skill;
                    proficiency = item.proficiency || item.level || 3;
                    confidence = item.confidence || 0.85;
                }
                
                // Match with taxonomy names
                const canonicalName = findCanonicalName(name);
                if (canonicalName) {
                    list.push({
                        name: canonicalName,
                        proficiency: Math.min(5, Math.max(1, parseInt(proficiency))),
                        confidence: parseFloat(confidence),
                        source: source || 'structured_json'
                    });
                }
            }
            if (list.length > 0) return list;
        }
    } catch (e) {
        // Not JSON, proceed to NLP parsing
    }

    const extracted = [];
    // Split text into sentences/lines to scan context
    const lines = text.split(/[\n\.\r]/).map(line => line.trim()).filter(line => line.length > 0);

    for (const [skillName, patterns] of Object.entries(SKILL_KEYWORDS)) {
        let isMatched = false;
        let matchedLine = '';
        
        // Find if skill matches any pattern in the text
        for (const line of lines) {
            for (const pattern of patterns) {
                if (pattern.test(line)) {
                    isMatched = true;
                    matchedLine = line;
                    break;
                }
            }
            if (isMatched) break;
        }

        if (isMatched) {
            let proficiency = 3; // Default level
            let confidence = 0.70; // Default confidence

            // Adjust proficiency based on context modifiers
            let modifierFound = false;
            for (const mod of PROFICIENCY_MODIFIERS) {
                for (const kw of mod.keywords) {
                    if (kw.test(matchedLine)) {
                        proficiency = mod.level;
                        modifierFound = true;
                        break;
                    }
                }
                if (modifierFound) break;
            }

            // Adjust confidence based on source
            if (source === 'cert_verification') {
                confidence = 0.95;
            } else if (source === 'github_profile') {
                confidence = 0.85;
            } else if (source === 'resume_upload') {
                // If found in a line mentioning certification, raise confidence
                if (/certif/i.test(matchedLine) || /award/i.test(matchedLine) || /degree/i.test(matchedLine)) {
                    confidence = 0.88;
                } else {
                    confidence = 0.75;
                }
            }

            // Make sure confidence is rounded
            confidence = Math.round(confidence * 100) / 100;

            extracted.push({
                name: skillName,
                proficiency,
                confidence,
                source: source || 'resume_upload'
            });
        }
    }

    return extracted;
}

function findCanonicalName(name) {
    if (!name) return null;
    const lower = name.toLowerCase().trim();
    for (const [skillName, patterns] of Object.entries(SKILL_KEYWORDS)) {
        if (skillName.toLowerCase() === lower) return skillName;
        for (const pattern of patterns) {
            if (pattern.test(lower)) {
                return skillName;
            }
        }
    }
    return null;
}

module.exports = {
    parseProfile,
    SKILL_KEYWORDS
};
