import { exec, spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { closeSync, openSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const LOG_DIR = resolve(process.cwd(), 'logs', 'servers');
const DOCKER_TIMEOUT_MS = 120_000;
const STARTUP_GRACE_MS = 700;
const STOP_TIMEOUT_MS = 10_000;
const STOP_POLL_MS = 250;
const PORT_OWNER_TIMEOUT_MS = 5_000;

export function logPathFor(serverId: string): string {
	return join(LOG_DIR, `${serverId}.log`);
}

export function isProcessAlive(pid: number | null | undefined): boolean {
	if (!pid || pid <= 0) {
		return false;
	}
	try {
		process.kill(pid, 0);
		return true;
	} catch (caught) {
		return (caught as NodeJS.ErrnoException).code === 'EPERM';
	}
}

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

export async function readLogTail(logPath: string, lineCount = 20): Promise<string> {
	try {
		const content = await readFile(logPath, 'utf8');
		const lines = content.split(/\r?\n/);
		while (lines.length > 0 && lines[lines.length - 1] === '') {
			lines.pop();
		}
		return lines.slice(-lineCount).join('\n');
	} catch {
		return '';
	}
}

export async function runShellCommand(
	command: string,
	cwd: string,
	timeoutMs = DOCKER_TIMEOUT_MS
): Promise<{ stdout: string; stderr: string }> {
	try {
		return await execAsync(command, { cwd, timeout: timeoutMs, windowsHide: true });
	} catch (caught) {
		const detail = caught as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
		const output = (detail.stderr || detail.stdout || '').trim();
		throw new Error(
			`running "${command}" in "${cwd}" failed: ${detail.message}` +
				(output ? `\n${output.slice(-2000)}` : ''),
			{ cause: caught }
		);
	}
}

export async function spawnBackgroundCommand(
	command: string,
	cwd: string,
	logPath: string,
	extraEnvironment: Record<string, string> = {}
): Promise<number> {
	await mkdir(dirname(logPath), { recursive: true });

	const logFd = openSync(logPath, 'a');
	try {
		const child = spawn(command, {
			cwd,
			shell: true,
			windowsHide: true,
			detached: true,
			stdio: ['ignore', logFd, logFd],
			env: { ...process.env, ...extraEnvironment }
		});

		child.on('error', () => {});

		if (!child.pid) {
			throw new Error(`spawning "${command}" in "${cwd}": the OS returned no pid`);
		}

		const pid = child.pid;
		child.unref();

		await wait(STARTUP_GRACE_MS);
		if (!isProcessAlive(pid)) {
			const tail = await readLogTail(logPath);
			throw new Error(
				`starting "${command}" in "${cwd}": the process exited immediately (pid ${pid})` +
					(tail ? `\nLast log lines:\n${tail}` : '')
			);
		}

		return pid;
	} finally {
		closeSync(logFd);
	}
}

/**
 * A row looks like:
 * `  TCP    0.0.0.0:7010    0.0.0.0:0    LISTENING    12345`
 */
export function parseNetstatListeningPids(stdout: string, port: number): number[] {
	const pids: number[] = [];

	for (const line of stdout.split(/\r?\n/)) {
		const columns = line.trim().split(/\s+/);
		if (columns.length < 5) {
			continue;
		}

		const [protocol, localAddress, , state, pidColumn] = columns;
		if (protocol.toLowerCase() !== 'tcp') {
			continue;
		}
		if (state.toLowerCase() !== 'listening') {
			continue;
		}
		if (!localAddress.endsWith(`:${port}`)) {
			continue;
		}

		const pid = Number(pidColumn);
		if (Number.isInteger(pid) && pid > 0 && !pids.includes(pid)) {
			pids.push(pid);
		}
	}

	return pids;
}

export function parseLsofPids(stdout: string): number[] {
	const pids: number[] = [];

	for (const line of stdout.split(/\r?\n/)) {
		const pid = Number(line.trim());
		if (Number.isInteger(pid) && pid > 0 && !pids.includes(pid)) {
			pids.push(pid);
		}
	}

	return pids;
}

export async function findPortOwnerPid(port: number): Promise<number | null> {
	try {
		if (process.platform === 'win32') {
			const { stdout } = await execAsync('netstat -ano -p tcp', {
				timeout: PORT_OWNER_TIMEOUT_MS,
				windowsHide: true
			});
			return parseNetstatListeningPids(stdout, port)[0] ?? null;
		}

		const { stdout } = await execAsync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, {
			timeout: PORT_OWNER_TIMEOUT_MS
		});
		return parseLsofPids(stdout)[0] ?? null;
	} catch {
		return null;
	}
}

export async function stopProcessTree(pid: number): Promise<void> {
	if (!isProcessAlive(pid)) {
		return;
	}

	if (process.platform === 'win32') {
		try {
			await execAsync(`taskkill /PID ${pid} /T /F`, { windowsHide: true });
		} catch (caught) {
			if (isProcessAlive(pid)) {
				throw new Error(
					`stopping process tree for pid ${pid} with taskkill: ${
						caught instanceof Error ? caught.message : String(caught)
					}`,
					{ cause: caught }
				);
			}
		}
	} else {
		killPosixTree(pid, 'SIGTERM');
		const deadline = Date.now() + STOP_TIMEOUT_MS / 2;
		while (isProcessAlive(pid) && Date.now() < deadline) {
			await wait(STOP_POLL_MS);
		}
		if (isProcessAlive(pid)) {
			killPosixTree(pid, 'SIGKILL');
		}
	}

	const deadline = Date.now() + STOP_TIMEOUT_MS;
	while (isProcessAlive(pid) && Date.now() < deadline) {
		await wait(STOP_POLL_MS);
	}

	if (isProcessAlive(pid)) {
		throw new Error(
			`stopping process tree for pid ${pid}: still alive ${STOP_TIMEOUT_MS}ms after the kill signal`
		);
	}
}

function killPosixTree(pid: number, signal: NodeJS.Signals): void {
	try {
		process.kill(-pid, signal);
	} catch {
		try {
			process.kill(pid, signal);
		} catch {
			// Already gone — the liveness loop above is the source of truth.
		}
	}
}
