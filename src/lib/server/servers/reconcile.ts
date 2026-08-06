import type { ManagedServer, ServerStatus } from '$lib/types';

export type ProcessRecordDecision =
	| { action: 'keep' }
	| { action: 'adopt'; pid: number; startedAt: string }
	| { action: 'clear' };

/**
 * Whether the port's owner is worth looking up: nothing answers for the stored
 * pid, yet the server's port is live. A Docker-published port is held by Docker's
 * proxy rather than by the server, so those rows are left alone.
 */
export function needsPortOwnerLookup(server: ManagedServer, status: ServerStatus): boolean {
	return status.process.state !== 'running' && status.port.listening && !server.docker;
}

/**
 * What to do with a server's stored pid, given a fresh probe and — when
 * {@link needsPortOwnerLookup} asked for it — the pid holding its port.
 *
 * Whatever listens on a server's own port is taken to be that server, so a poll
 * reclaims the pid whether the stored one died or was never recorded. Without
 * that, a record cleared once could never recover, and the row would read as
 * stopped with no pid for Stop and Restart to act on while the app was serving.
 *
 * Only a closed port clears a record.
 */
export function decideProcessRecord(
	server: ManagedServer,
	status: ServerStatus,
	portOwnerPid: number | null,
	now: string
): ProcessRecordDecision {
	if (status.process.state === 'running') {
		return { action: 'keep' };
	}

	if (status.port.listening) {
		if (server.docker || portOwnerPid === null) {
			return { action: 'keep' };
		}
		return { action: 'adopt', pid: portOwnerPid, startedAt: server.startedAt ?? now };
	}

	return server.pid === null ? { action: 'keep' } : { action: 'clear' };
}
