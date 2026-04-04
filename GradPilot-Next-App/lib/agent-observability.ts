import { promises as fs } from 'fs';
import path from 'path';

export const AGENT_LOG_ROOT = path.join(process.cwd(), 'agent-logs');

export type ObservabilityCategory =
	| 'agents'
	| 'ai-provider'
	| 'ai-sdk-executor'
	| 'api'
	| 'errors'
	| 'unified-executor'
	| 'workflows';

const OBSERVABILITY_CATEGORIES: ObservabilityCategory[] = [
	'agents',
	'ai-provider',
	'ai-sdk-executor',
	'api',
	'errors',
	'unified-executor',
	'workflows',
];

function toDateStamp(date: Date = new Date()): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function sanitizeFileSegment(value: string): string {
	return String(value || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function toRelativeLogPath(absolutePath: string): string {
	return path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');
}

async function appendLine(filePath: string, line: string): Promise<void> {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.appendFile(filePath, `${line}\n`, 'utf8');
}

export async function ensureObservabilityFolders(): Promise<void> {
	await Promise.all(
		OBSERVABILITY_CATEGORIES.map((category) =>
			fs.mkdir(path.join(AGENT_LOG_ROOT, category), { recursive: true })
		)
	);

	await fs.mkdir(path.join(AGENT_LOG_ROOT, 'workflows', 'web-research-cache'), {
		recursive: true,
	});
}

export async function appendObservabilityLog(
	category: ObservabilityCategory,
	payload: Record<string, any>
): Promise<string | null> {
	try {
		await ensureObservabilityFolders();

		const logFilePath = path.join(AGENT_LOG_ROOT, category, `${toDateStamp()}.log`);
		const logRecord = {
			timestamp: new Date().toISOString(),
			...payload,
		};

		await appendLine(logFilePath, JSON.stringify(logRecord));
		return toRelativeLogPath(logFilePath);
	} catch (err) {
		console.error('[observability] failed to append log', err);
		return null;
	}
}

export interface WebResearchSnapshot {
	runId: string;
	workflowRunId?: string;
	nodeId: string;
	createdAt: string;
	csv: string;
	leadsWithEmail: Array<{ name?: string; email: string; score?: number }>;
	summary?: Record<string, any>;
}

export async function saveWebResearchSnapshot(
	snapshot: WebResearchSnapshot
): Promise<{ latestPath: string | null; historyPath: string | null }> {
	try {
		await ensureObservabilityFolders();

		const cacheDir = path.join(AGENT_LOG_ROOT, 'workflows', 'web-research-cache');
		const safeNodeId = sanitizeFileSegment(snapshot.nodeId);
		const safeRunId = sanitizeFileSegment(snapshot.runId || Date.now().toString());

		const latestPath = path.join(cacheDir, `${safeNodeId}.json`);
		const historyPath = path.join(cacheDir, `${safeNodeId}-${safeRunId}.json`);

		const normalizedSnapshot = {
			...snapshot,
			createdAt: snapshot.createdAt || new Date().toISOString(),
		};

		await fs.writeFile(latestPath, JSON.stringify(normalizedSnapshot, null, 2), 'utf8');
		await fs.writeFile(historyPath, JSON.stringify(normalizedSnapshot, null, 2), 'utf8');

		await appendObservabilityLog('workflows', {
			event: 'web_research_snapshot_saved',
			runId: snapshot.runId,
			workflowRunId: snapshot.workflowRunId || null,
			nodeId: snapshot.nodeId,
			leadsWithEmail: snapshot.leadsWithEmail.length,
			latestPath: toRelativeLogPath(latestPath),
			historyPath: toRelativeLogPath(historyPath),
		});

		return {
			latestPath: toRelativeLogPath(latestPath),
			historyPath: toRelativeLogPath(historyPath),
		};
	} catch (err) {
		console.error('[observability] failed to save web research snapshot', err);
		return { latestPath: null, historyPath: null };
	}
}

export async function readLatestWebResearchSnapshot(
	nodeId: string
): Promise<WebResearchSnapshot | null> {
	try {
		const cachePath = path.join(
			AGENT_LOG_ROOT,
			'workflows',
			'web-research-cache',
			`${sanitizeFileSegment(nodeId)}.json`
		);

		const content = await fs.readFile(cachePath, 'utf8');
		return JSON.parse(content) as WebResearchSnapshot;
	} catch {
		return null;
	}
}
