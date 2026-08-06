import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ServerCard from '$lib/components/ServerCard.svelte';
import type { ManagedServer, ServerStatus } from '$lib/types';

function server(overrides: Partial<ManagedServer> = {}): ManagedServer {
	return {
		id: 'server-1',
		alias: 'knowledge',
		directory: 'C:\\projects\\knowledge',
		serverType: 'node',
		port: 9150,
		docker: false,
		dockerCommand: '',
		pid: null,
		startedAt: null,
		logPath: null,
		createdAt: '2026-08-06T09:00:00.000Z',
		...overrides
	};
}

function status(overrides: Partial<ServerStatus> = {}): ServerStatus {
	return {
		id: 'server-1',
		checkedAt: '2026-08-06T12:00:00.000Z',
		process: { state: 'stopped', pid: null, startedAt: null },
		port: { configured: 9150, listening: false },
		docker: { enabled: false, state: 'stopped', services: [], error: null },
		...overrides
	};
}

function handlers() {
	return {
		onRefresh: vi.fn(),
		onToggle: vi.fn(),
		onRestart: vi.fn(),
		onEdit: vi.fn()
	};
}

describe('identity', () => {
	it('shows the alias, type tag, port and directory', async () => {
		const page = render(ServerCard, { server: server(), status: status(), ...handlers() });

		await expect.element(page.getByText('knowledge', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('npm')).toBeInTheDocument();
		await expect.element(page.getByText(':9150')).toBeInTheDocument();
		await expect.element(page.getByText('C:\\projects\\knowledge')).toBeInTheDocument();
	});

	it('tags a python server as python', async () => {
		const page = render(ServerCard, {
			server: server({ serverType: 'python' }),
			status: status(),
			...handlers()
		});

		await expect.element(page.getByText('python')).toBeInTheDocument();
	});

	it('links to the recorded port in a new tab', async () => {
		const page = render(ServerCard, { server: server(), status: status(), ...handlers() });
		const link = page.getByRole('link', { name: /Open/ });

		await expect.element(link).toHaveAttribute('href', 'http://localhost:9150');
		await expect.element(link).toHaveAttribute('target', '_blank');
	});
});

describe('status pills', () => {
	it('waits for a status before claiming anything', async () => {
		const page = render(ServerCard, { server: server(), status: undefined, ...handlers() });
		await expect.element(page.getByText('status pending…')).toBeInTheDocument();
	});

	it('reports a stopped process and a closed port', async () => {
		const page = render(ServerCard, { server: server(), status: status(), ...handlers() });

		await expect.element(page.getByText('process stopped')).toBeInTheDocument();
		await expect.element(page.getByText('port 9150 closed')).toBeInTheDocument();
	});

	it('reports the pid of a running process', async () => {
		const page = render(ServerCard, {
			server: server(),
			status: status({ process: { state: 'running', pid: 4242, startedAt: null } }),
			...handlers()
		});

		await expect.element(page.getByText('process running · pid 4242')).toBeInTheDocument();
	});

	it('hides the Docker pill for a server without Docker', async () => {
		const page = render(ServerCard, { server: server(), status: status(), ...handlers() });
		await expect.element(page.getByText(/^docker/)).not.toBeInTheDocument();
	});

	it('counts Docker services when Docker is enabled', async () => {
		const page = render(ServerCard, {
			server: server({ docker: true }),
			status: status({
				docker: {
					enabled: true,
					state: 'partial',
					services: [
						{ name: 'db', state: 'running' },
						{ name: 'web', state: 'exited' }
					],
					error: null
				}
			}),
			...handlers()
		});

		await expect.element(page.getByText('docker partial 1/2')).toBeInTheDocument();
	});
});

describe('start and stop', () => {
	it('offers Start when nothing is up', async () => {
		const page = render(ServerCard, { server: server(), status: status(), ...handlers() });
		await expect
			.element(page.getByRole('button', { name: 'Start', exact: true }))
			.toBeInTheDocument();
	});

	it('offers Stop when the process is alive', async () => {
		const page = render(ServerCard, {
			server: server(),
			status: status({ process: { state: 'running', pid: 4242, startedAt: null } }),
			...handlers()
		});

		await expect
			.element(page.getByRole('button', { name: 'Stop', exact: true }))
			.toBeInTheDocument();
	});

	it('offers Stop when only the port answers', async () => {
		const page = render(ServerCard, {
			server: server(),
			status: status({ port: { configured: 9150, listening: true } }),
			...handlers()
		});

		await expect
			.element(page.getByRole('button', { name: 'Stop', exact: true }))
			.toBeInTheDocument();
	});
});

describe('actions', () => {
	it('calls back for refresh, toggle, restart and edit', async () => {
		const calls = handlers();
		const page = render(ServerCard, { server: server(), status: status(), ...calls });

		await page.getByRole('button', { name: '⟳' }).click();
		await page.getByRole('button', { name: 'Start', exact: true }).click();
		await page.getByRole('button', { name: 'Restart' }).click();
		await page.getByRole('button', { name: 'Edit' }).click();

		expect(calls.onRefresh).toHaveBeenCalledOnce();
		expect(calls.onToggle).toHaveBeenCalledOnce();
		expect(calls.onRestart).toHaveBeenCalledOnce();
		expect(calls.onEdit).toHaveBeenCalledOnce();
	});

	it('disables its buttons and shows … while busy', async () => {
		const page = render(ServerCard, {
			server: server(),
			status: status(),
			busy: true,
			...handlers()
		});

		await expect.element(page.getByRole('button', { name: '…' })).toBeDisabled();
		await expect.element(page.getByRole('button', { name: 'Restart' })).toBeDisabled();
		await expect.element(page.getByRole('button', { name: 'Edit' })).toBeDisabled();
	});
});

describe('row error', () => {
	it('shows a failure beside the row', async () => {
		const page = render(ServerCard, {
			server: server(),
			status: status(),
			error: 'starting managed server "knowledge": port 9150 is already listening',
			...handlers()
		});

		await expect.element(page.getByText(/port 9150 is already listening/)).toBeInTheDocument();
	});

	it('shows nothing when there is no failure', async () => {
		const page = render(ServerCard, { server: server(), status: status(), ...handlers() });
		await expect.element(page.getByText(/already listening/)).not.toBeInTheDocument();
	});
});
