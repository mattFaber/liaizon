import { runtimeConfig } from '$server/config';
import { CloudTasksClient } from '@google-cloud/tasks';
import { ValidationError } from '$validation/errors';

const tasksClient = new CloudTasksClient();

function getBulkQueuePath(projectId: string): string {
	const { location, bulkGenerationQueue } = runtimeConfig.queues;

	if (!location || !bulkGenerationQueue) {
		throw new ValidationError(
			'Cloud Tasks queue settings are missing from environment configuration.'
		);
	}

	return tasksClient.queuePath(projectId, location, bulkGenerationQueue);
}

export async function enqueueBulkGenerationTask(
	projectId: string,
	payload: Record<string, unknown>,
	url: string
): Promise<void> {
	const parent = getBulkQueuePath(projectId);

	await tasksClient.createTask({
		parent,
		task: {
			httpRequest: {
				httpMethod: 'POST',
				url,
				headers: {
					'Content-Type': 'application/json'
				},
				body: Buffer.from(JSON.stringify(payload)).toString('base64')
			}
		}
	});
}
