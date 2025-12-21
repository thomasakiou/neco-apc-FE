import { PostingCreate, PostingListResponse, PostingResponse, PostingUpdate, BulkPostingCreateRequest, BulkUploadResponse } from '../types/posting';

import { API_BASE_URL } from '../src/config';

import { getAuthHeaders } from './apiUtils';

const API_URL = `${API_BASE_URL}/posting`;
const BASE_URL = API_URL;

// Cache for Posting Records
let postingCache: PostingResponse[] | null = null;

export const getAllPostings = async (skip: number = 0, limit: number = 100): Promise<PostingListResponse> => {
    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString()
    });

    const response = await fetch(`${BASE_URL}?${params.toString()}`, {
        headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('Failed to fetch postings');
    return response.json();
};

// Fetch ALL records for client-side filtering/export if needed
export const getAllPostingRecords = async (force: boolean = false): Promise<PostingResponse[]> => {
    // Return cached data if available and not forced
    if (postingCache && !force) {
        return postingCache;
    }

    const response = await fetch(`${BASE_URL}?skip=0&limit=100000`, {
        headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('Failed to fetch all posting records');
    const data = await response.json();

    // Store in cache
    postingCache = data.items;

    return data.items;
};

export const createPosting = async (data: PostingCreate): Promise<PostingResponse> => {
    const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Failed to create posting');

    postingCache = null; // Invalidate cache
    return response.json();
};

export const updatePosting = async (id: string, data: PostingUpdate): Promise<PostingResponse> => {
    const response = await fetch(`${BASE_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Failed to update posting');

    postingCache = null; // Invalidate cache
    return response.json();
};

export const deletePosting = async (id: string): Promise<any> => {
    const response = await fetch(`${BASE_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('Failed to delete posting');

    postingCache = null; // Invalidate cache
    return response.json();
};

export const bulkDeletePostings = async (ids: string[]): Promise<any> => {
    const response = await fetch(`${BASE_URL}/bulk-delete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids })
    });

    if (!response.ok) throw new Error('Failed to bulk delete postings');

    postingCache = null; // Invalidate cache
    return response.json();
};

export const deleteAllPostings = async (): Promise<any> => {
    const response = await fetch(`${BASE_URL}/all`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('Failed to delete all postings');

    postingCache = null; // Invalidate cache
    return response.json();
};

export const bulkCreatePostings = async (data: BulkPostingCreateRequest): Promise<BulkUploadResponse> => {
    console.log('Sending Bulk Create Payload:', JSON.stringify(data, null, 2));
    const response = await fetch(`${BASE_URL}/bulk`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Failed to bulk create postings');

    postingCache = null; // Invalidate cache
    return response.json();
};
