import type { PostHogConfig } from 'posthog-js';
import { PUBLIC_POSTHOG_HOST, PUBLIC_POSTHOG_PROJECT_TOKEN } from '$env/static/public';

export const posthogConfig: Partial<PostHogConfig> = {
    api_host: PUBLIC_POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: true,
    enable_heatmaps: false,
    autocapture: false,
    // debug: false,
};

export function getPostHogProjectToken() {
    return PUBLIC_POSTHOG_PROJECT_TOKEN;
}
