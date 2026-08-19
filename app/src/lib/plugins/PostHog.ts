import type { PostHogConfig } from 'posthog-js';
import { PUBLIC_POSTHOG_KEY } from '$env/static/public';


console.info('🔍 PostHog: Config file loaded');

export const posthogConfig: Partial<PostHogConfig> = {
    api_host: 'https://us.i.posthog.com',
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: true,
    enable_heatmaps: false,
    autocapture: false,
    debug: false,
};

export const posthogServerConfig = {
    host: 'https://us.i.posthog.com'
};

export const getPostHogKey = () => {
    if (!PUBLIC_POSTHOG_KEY) {
        console.error('❌ PostHog: API key is not defined');
    }
    return PUBLIC_POSTHOG_KEY;
};
