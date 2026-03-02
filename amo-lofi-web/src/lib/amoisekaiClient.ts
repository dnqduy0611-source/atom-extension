/**
 * Amoisekai API Client
 *
 * Wraps fetch để tự động đính kèm Supabase access token vào mọi request.
 *
 * Cách dùng:
 *   import { amoisekaiApi } from '../lib/amoisekaiClient';
 *
 *   // GET
 *   const player = await amoisekaiApi.get(`/api/player/${userId}`);
 *
 *   // POST
 *   const story = await amoisekaiApi.post('/api/story/start', { user_id: userId, ... });
 *
 *   // Streaming (SSE)
 *   const url = amoisekaiApi.streamUrl('/api/story/stream/scene-start', { user_id, ... });
 *   const es = amoisekaiApi.createEventSource(url);
 */

import { supabase } from './supabaseClient';

const BASE_URL = import.meta.env.VITE_STORIES_ENGINE_URL ?? 'http://localhost:8001';

// ─────────────────────────────────────────────────────────────────────────────
// Core: lấy token từ session Supabase hiện tại
// ─────────────────────────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error('Chưa đăng nhập. Vui lòng đăng nhập để tiếp tục.');
    }
    return session.access_token;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core fetch với auth header
// ─────────────────────────────────────────────────────────────────────────────

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await getToken();

    const res = await fetch(`${BASE_URL}${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...init.headers,
            'Authorization': `Bearer ${token}`,   // ← đây là phần quan trọng
        },
    });

    if (res.status === 401) throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
    if (res.status === 403) throw new Error('Không có quyền truy cập.');
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Lỗi server: ${res.status}`);
    }

    return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export const amoisekaiApi = {
    /** GET — trả về JSON đã parse */
    async get<T = unknown>(path: string): Promise<T> {
        const res = await authFetch(path, { method: 'GET' });
        return res.json() as Promise<T>;
    },

    /** POST — nhận body object, trả về JSON đã parse */
    async post<T = unknown>(path: string, body?: unknown): Promise<T> {
        const res = await authFetch(path, {
            method: 'POST',
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        return res.json() as Promise<T>;
    },

    /** DELETE — trả về JSON đã parse */
    async delete<T = unknown>(path: string): Promise<T> {
        const res = await authFetch(path, { method: 'DELETE' });
        return res.json() as Promise<T>;
    },

    /**
     * Tạo URL cho SSE streaming (EventSource không hỗ trợ custom headers,
     * nên ta truyền token qua query param và backend cần đọc từ `?token=`).
     *
     * Lưu ý: stream endpoints cần được cập nhật để chấp nhận token từ query.
     */
    async streamUrl(path: string, params: Record<string, string> = {}): Promise<string> {
        const token = await getToken();
        const qs = new URLSearchParams({ ...params, token });
        return `${BASE_URL}${path}?${qs.toString()}`;
    },

    /**
     * Tạo EventSource đã được auth cho SSE streaming.
     * Dùng cho /api/story/stream/* endpoints.
     */
    async createEventSource(path: string, params: Record<string, string> = {}): Promise<EventSource> {
        const url = await this.streamUrl(path, params);
        return new EventSource(url);
    },
};
