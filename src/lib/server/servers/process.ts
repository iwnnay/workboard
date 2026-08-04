import { exec, spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { closeSync, openSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/** Where per-server stdout/stderr is appended. Already git-ignored. */
const LOG_DIR = resolve(process.cwd(), 'logs', 'servers');

/** How long a Docker command may run before we give up on it. */
const DOCKER_TIMEOUT_MS = 120_000;

/** Grace period after spawning before we check the process is still up. */
const STARTUP_GRACE_MS = 700;

/** How long we wait for a killed process tree to actually disappear. */
const STOP_TIMEOUT_MS = 10_000;
const STOP_POLL_MS = 250;

export function logPathFor(serverId: string): string {
	return join(LOG_DIR, `${serverId}.log`);
}

/**
 * Whether `pid` names a live process. Signal 0 performs the permission and
 * existence checks without delivering anything; `EPERM` means the process is
 * there but owned by someone else, which still counts as running.
 *
 * Caveat: after the workboard itself restarts we only have the stored pid, so
 * a recycled pid can read as running. The port probe in `status.ts` is the
 * tie-breaker the UI shows alongside it.
 */
export function isProcessAlive(pid: number | null | undefined): boolean {
	if (!pid || pid <= 0) return false;
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

/** Last `lineCount` lines of a server log, for error messages. */
export async function readLogTail(logPath: string, lineCount = 20): Promise<string> {
	try {
		const content = await readFile(logPath, 'utf8');
		const lines = content.split(/\r?\n/);
		while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
		return lines.slice(-lineCount).join('\n');
	} catch {
		return '';
	}
}

/**
 * Run a one-shot shell command (Docker, mostly) and return its output. Throws
 * with the command, directory and captured stderr so a failure is diagnosable
 * from the log alone.
 */
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

/**
 * Launch `command` in `cwd` as a background process, appending its output to
 * `logPath`. `extraEnvironment` is overlaid on this process's environment —
 * that is how a Python server receives its `PORT`. Returns the pid of the
 * launched shell, which is what we later kill (as a tree, so the shell's
 * children go with it).
 */
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
			detached: process.platform !== 'win32',
			stdio: ['ignore', logFd, logFd],
			env: { ...process.env, ...extraEnvironment }
		});

		// Errors arrive asynchronously; without a listener they would crash the
		// workboard process itself once we unref the child.
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
 * Kill a process and everything it spawned. `npm run dev` and `uv run` both
 * sit behind a shell wrapper, so killing the recorded pid alone would orphan
 * the actual server.
 */
export async function stopProcessTree(pid: number): Promise<void> {
	if (!isProcessAlive(pid)) return;

	if (process.platform === 'win32') {
		try {
			await execAsync(`taskkill /PID ${pid} /T /F`, { windowsHide: true });
		} catch (caught) {
			// taskkill exits non-zero when the process is already gone; only a
			// still-live process makes that an actual failure.
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
		while (isProcessAlive(pid) && Date.now() < deadline) await wait(STOP_POLL_MS);
		if (isProcessAlive(pid)) killPosixTree(pid, 'SIGKILL');
	}

	const deadline = Date.now() + STOP_TIMEOUT_MS;
	while (isProcessAlive(pid) && Date.now() < deadline) await wait(STOP_POLL_MS);

	if (isProcessAlive(pid)) {
		throw new Error(
			`stopping process tree for pid ${pid}: still alive ${STOP_TIMEOUT_MS}ms after the kill signal`
		);
	}
}

function killPosixTree(pid: number, signal: NodeJS.Signals): void {
	try {
		// Negative pid targets the process group created by `detached: true`.
		process.kill(-pid, signal);
	} catch {
		try {
			process.kill(pid, signal);
		} catch {
			// Already gone — the liveness loop above is the source of truth.
		}
	}
}
