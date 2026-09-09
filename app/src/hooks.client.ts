import { dev } from '$app/environment';
import type { HandleClientError } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import posthog from 'posthog-js';

// $env/dynamic/public is read at runtime (unlike $env/static/public, which is
// baked in at build time), so PUBLIC_POSTHOG_* can be configured via
// environment variables in production (e.g. docker-compose).
const POSTHOG_TOKEN = env.PUBLIC_POSTHOG_PROJECT_TOKEN;
const POSTHOG_HOST = env.PUBLIC_POSTHOG_HOST;

export function init() {
	if (!POSTHOG_TOKEN || !POSTHOG_HOST) {
		if (dev) {
			const missingVariable = !POSTHOG_TOKEN
				? 'PUBLIC_POSTHOG_PROJECT_TOKEN'
				: 'PUBLIC_POSTHOG_HOST';
			throw new Error(
				`${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`
			);
		}

		return;
	}

	posthog.init(POSTHOG_TOKEN, {
		api_host: POSTHOG_HOST,
		capture_exceptions: {
			capture_unhandled_errors: true,
			capture_unhandled_rejections: true,
			capture_console_errors: false
		}
	});
}

export const handleError: HandleClientError = ({ error, status, message }) => {
	if (POSTHOG_TOKEN && POSTHOG_HOST) {
		posthog.captureException(error);
	}

	return { message, status };
};