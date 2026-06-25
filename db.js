const { Pool } = require('pg');
require('dotenv').config();

// Global list to store SQL query execution logs
const sqlLogs = [];

function logSQL(queryText, params) {
    const timestamp = new Date().toLocaleTimeString();
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

// Establish PostgreSQL/ShaktiDB connection pool
console.log("Connecting to PostgreSQL/ShaktiDB database...");
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});

// Quick connection verification on startup
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error("\x1b[31m[ShaktiDB Connection Fatal Error]\x1b[0m", err.message);
        console.error("Please verify that your database server is running and configuration credentials in .env are correct.");
        process.exit(1);
    } else {
        console.log("\x1b[32m[ShaktiDB Connection Successful]\x1b[0m running on standard PostgreSQL compatibility layer.");
    }
});

module.exports = {
    query: async (text, params) => {
        logSQL(text, params);
        return await pool.query(text, params);
    },
    getLogs: () => sqlLogs,
    clearLogs: () => { sqlLogs.length = 0; },
    isMock: () => false
};
