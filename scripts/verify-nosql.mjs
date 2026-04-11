import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packageJsonPath = path.join(root, 'package.json');

const blockedPackages = new Set([
	'pg',
	'postgres',
	'mysql',
	'mysql2',
	'sqlite',
	'sqlite3',
	'better-sqlite3',
	'knex',
	'sequelize',
	'typeorm',
	'prisma',
	'@prisma/client'
]);

const blockedCodePatterns = [
	/\bSELECT\s+.+\s+FROM\b/i,
	/\bINSERT\s+INTO\s+\w+/i,
	/\bUPDATE\s+\w+\s+SET\s+/i,
	/\bDELETE\s+FROM\s+\w+/i,
	/\bCREATE\s+TABLE\s+\w+/i,
	/\bALTER\s+TABLE\s+\w+/i,
	/\bDROP\s+TABLE\s+\w+/i,
	/\bfrom\s+['"](pg|mysql2?|sqlite3?|better-sqlite3|knex|sequelize|typeorm|@prisma\/client)['"]/i,
	/\brequire\((['"])(pg|mysql2?|sqlite3?|better-sqlite3|knex|sequelize|typeorm|@prisma\/client)\1\)/i
];

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function gatherDependencyNames(pkg) {
	return new Set([
		...Object.keys(pkg.dependencies ?? {}),
		...Object.keys(pkg.devDependencies ?? {}),
		...Object.keys(pkg.optionalDependencies ?? {})
	]);
}

function walk(dir, results = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === 'node_modules' || entry.name === '.svelte-kit' || entry.name === 'build') {
			continue;
		}

		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			walk(fullPath, results);
			continue;
		}

		if (/\.(ts|js|svelte|mjs|cjs)$/.test(entry.name)) {
			results.push(fullPath);
		}
	}

	return results;
}

function toRel(filePath) {
	return path.relative(root, filePath);
}

function verifyDependencies(pkg) {
	const deps = gatherDependencyNames(pkg);
	const violations = [...blockedPackages].filter((name) => deps.has(name));

	if (violations.length === 0) {
		return [];
	}

	return violations.map((name) => `Blocked dependency detected: ${name}`);
}

function verifySourceFiles() {
	const files = walk(path.join(root, 'src'));
	const violations = [];

	for (const file of files) {
		const content = fs.readFileSync(file, 'utf8');
		for (const pattern of blockedCodePatterns) {
			if (pattern.test(content)) {
				violations.push(`Blocked SQL/ORM pattern in ${toRel(file)}: ${pattern}`);
			}
		}
	}

	return violations;
}

function main() {
	if (!fs.existsSync(packageJsonPath)) {
		console.error('package.json not found.');
		process.exit(1);
	}

	const pkg = readJson(packageJsonPath);
	const violations = [...verifyDependencies(pkg), ...verifySourceFiles()];

	if (violations.length > 0) {
		console.error('NoSQL verification failed. Found blocked SQL usage:');
		for (const item of violations) {
			console.error(`- ${item}`);
		}
		process.exit(1);
	}

	console.log('NoSQL verification passed: Firestore/NoSQL-only constraints intact.');
}

main();
