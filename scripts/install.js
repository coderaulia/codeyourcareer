import 'dotenv/config';
import { createInterface } from 'node:readline';
import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function askYesNo(question, defaultValue = false) {
  return new Promise((resolve) => {
    const options = defaultValue ? '[Y/n]' : '[y/N]';
    rl.question(`${question} ${options}: `, (answer) => {
      const normalized = answer.trim().toLowerCase();
      if (!normalized) {
        resolve(defaultValue);
        return;
      }
      resolve(normalized === 'y' || normalized === 'yes');
    });
  });
}

function generateSecret(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function testMySQLConnection(host, port, user, password, database) {
  try {
    const connection = await mysql.createConnection({
      host,
      port: Number(port),
      user,
      password,
      database,
      connectTimeout: 10000,
    });
    await connection.ping();
    await connection.end();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function createDatabaseIfNotExists(host, port, user, password, database) {
  try {
    const connection = await mysql.createConnection({
      host,
      port: Number(port),
      user,
      password,
      connectTimeout: 10000,
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.end();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function runMigrations(host, port, user, password, database) {
  const migrationFiles = [
    path.join(rootDir, 'database', 'mysql-schema.sql'),
    path.join(rootDir, 'database', 'mysql-upgrade-2026-03.sql'),
  ];

  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port: Number(port),
      user,
      password,
      database,
      multipleStatements: true,
      connectTimeout: 30000,
    });

    for (const file of migrationFiles) {
      if (!existsSync(file)) {
        console.log(`  Skipping ${path.basename(file)} - not found`);
        continue;
      }
      console.log(`  Running ${path.basename(file)}...`);
      const sql = await import('node:fs').then((fs) => fs.promises.readFile(file, 'utf8'));
      await connection.query(sql);
    }

    await connection.end();
    return { success: true };
  } catch (error) {
    if (connection) {
      try {
        await connection.end();
      } catch {}
    }
    return { success: false, error: error.message };
  }
}

async function createAdminUser(host, port, user, password, database, email, adminPassword) {
  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port: Number(port),
      user,
      password,
      database,
      connectTimeout: 10000,
    });

    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const adminId = randomUUID();

    await connection.query(
      `INSERT INTO admin_users (id, email, password_hash, role, session_version)
       VALUES (?, ?, ?, 'admin', 1)
       ON DUPLICATE KEY UPDATE email = VALUES(email), password_hash = VALUES(password_hash)`,
      [adminId, email, passwordHash]
    );

    await connection.end();
    return { success: true };
  } catch (error) {
    if (connection) {
      try {
        await connection.end();
      } catch {}
    }
    return { success: false, error: error.message };
  }
}

async function seedSampleData(host, port, user, password, database) {
  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port: Number(port),
      user,
      password,
      database,
      connectTimeout: 10000,
    });

    const consultationId = randomUUID();
    await connection.query(
      `INSERT INTO links (id, title, url, icon, display_order, is_active, link_type, internal_target, style_bg)
       VALUES (?, 'Career Consultation', '#consultation', 'bi-calendar-check', 0, 1, 'internal', 'consultation', '#eef2ff')
       ON DUPLICATE KEY UPDATE title = title`,
      [consultationId]
    );

    const freebiesId = randomUUID();
    await connection.query(
      `INSERT INTO links (id, title, url, icon, display_order, is_active, link_type, internal_target, style_bg)
       VALUES (?, 'Free Resources', '#freebies', 'bi-download', 1, 1, 'internal', 'freebies', '#f5f7f8')
       ON DUPLICATE KEY UPDATE title = title`,
      [freebiesId]
    );

    await connection.query(
      `UPDATE modules SET is_enabled = TRUE WHERE slug = 'consultation'`
    );

    await connection.end();
    return { success: true };
  } catch (error) {
    if (connection) {
      try {
        await connection.end();
      } catch {}
    }
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('\n========================================');
  console.log('  CodeYourCareer Setup Wizard');
  console.log('========================================\n');
  console.log('This wizard will help you set up your CodeYourCareer site.\n');

  console.log('--- Database Configuration ---\n');

  const dbHost = await ask('MySQL host (localhost): ') || 'localhost';
  const dbPort = await ask('MySQL port (3306): ') || '3306';
  const dbName = await ask('Database name (codeyourcareer): ') || 'codeyourcareer';
  const dbUser = await ask('MySQL user: ');
  const dbPassword = await ask('MySQL password: ');

  console.log('\n--- Testing Database Connection ---');
  console.log('Connecting to MySQL...');

  let result = await testMySQLConnection(dbHost, dbPort, dbUser, dbPassword, dbName);
  if (!result.success) {
    if (result.error.includes('Unknown database')) {
      console.log('Database does not exist. Creating...');
      result = await createDatabaseIfNotExists(dbHost, dbPort, dbUser, dbPassword, dbName);
      if (!result.success) {
        console.error('\nError: Could not create database:', result.error);
        process.exit(1);
      }
      console.log('Database created successfully.');
    } else if (result.error.includes('Access denied')) {
      console.error('\nError: Access denied. Check your MySQL credentials.');
      process.exit(1);
    } else {
      console.error('\nError: Could not connect to MySQL:', result.error);
      process.exit(1);
    }
  } else {
    console.log('Connected successfully.');
  }

  console.log('\n--- Running Database Migrations ---');
  result = await runMigrations(dbHost, dbPort, dbUser, dbPassword, dbName);
  if (!result.success) {
    console.error('\nError: Migration failed:', result.error);
    process.exit(1);
  }
  console.log('Migrations completed successfully.');

  console.log('\n--- Admin Account ---');
  const adminEmail = await ask('Admin email (admin@example.com): ') || 'admin@example.com';
  let adminPassword = await ask('Admin password (min 10 characters): ');
  while (adminPassword.length < 10) {
    if (adminPassword) {
      console.log('Password must be at least 10 characters.');
    }
    adminPassword = await ask('Admin password (min 10 characters): ');
  }

  console.log('\nCreating admin account...');
  result = await createAdminUser(dbHost, dbPort, dbUser, dbPassword, dbName, adminEmail, adminPassword);
  if (!result.success) {
    console.error('\nError: Could not create admin user:', result.error);
    process.exit(1);
  }
  console.log('Admin account created successfully.');

  const seedSample = await askYesNo('Would you like to add sample content (recommended for new installations)?', true);
  if (seedSample) {
    console.log('\nSeeding sample content...');
    result = await seedSampleData(dbHost, dbPort, dbUser, dbPassword, dbName);
    if (!result.success) {
      console.warn('Warning: Could not seed sample content:', result.error);
    } else {
      console.log('Sample content added.');
    }
  }

  console.log('\n--- Site Configuration ---');
  const siteName = await ask(`Site name (My Career Site): `) || 'My Career Site';
  const frontendUrl = await ask('Frontend URL (leave empty if same as API): ') || '';

  console.log('\n--- Generating Configuration File ---');

  const sessionSecret = generateSecret();
  const envContent = `# CodeYourCareer Environment Configuration
# Generated by setup wizard

PORT=3000
NODE_ENV=development
SESSION_SECRET=${sessionSecret}
SESSION_COOKIE_SECURE=auto

MYSQL_HOST=${dbHost}
MYSQL_PORT=${dbPort}
MYSQL_DATABASE=${dbName}
MYSQL_USER=${dbUser}
MYSQL_PASSWORD=${dbPassword}
MYSQL_CONNECTION_LIMIT=10

ADMIN_EMAIL=${adminEmail}
ADMIN_PASSWORD=${adminPassword}

${frontendUrl ? `VITE_API_BASE_URL=${frontendUrl}` : '# VITE_API_BASE_URL='}
CORS_ALLOWED_ORIGINS=${frontendUrl ? frontendUrl : 'http://localhost:5173'}

UPLOAD_DIR=storage/uploads
MAX_UPLOAD_MB=5
DATA_RETENTION_DAYS=90
BACKUP_DIR=storage/backups
MAX_BACKUPS=5
BACKUP_RATE_LIMIT_HOURS=1
LOGIN_RATE_LIMIT_WINDOW_MS=900000
LOGIN_RATE_LIMIT_MAX_ATTEMPTS=5
`;

  const envPath = path.join(rootDir, '.env');
  if (existsSync(envPath)) {
    const overwrite = await askYesNo('A .env file already exists. Overwrite?', false);
    if (!overwrite) {
      console.log('\nSkipping .env file creation.');
    } else {
      writeFileSync(envPath, envContent, 'utf8');
      console.log('.env file updated successfully.');
    }
  } else {
    writeFileSync(envPath, envContent, 'utf8');
    console.log('.env file created successfully.');
  }

  console.log('\n========================================');
  console.log('  Setup Complete!');
  console.log('========================================\n');
  console.log('Next steps:');
  console.log('  1. Run: npm run dev:api');
  console.log('  2. Open: http://localhost:5173/adminpanel');
  console.log('  3. Login with your admin credentials\n');

  rl.close();
}

main().catch((error) => {
  console.error('\nSetup failed:', error.message);
  rl.close();
  process.exit(1);
});
