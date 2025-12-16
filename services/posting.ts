import { PostingCreate, PostingListResponse, PostingResponse, PostingUpdate, BulkPostingCreateRequest, BulkUploadResponse } from '../types/posting';

import { API_BASE_URL } from '../src/config';

const API_URL = `${API_BASE_URL}/posting`;
const BASE_URL = API_URL;

const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return token ? {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    } : {
        'Content-Type': 'application/json'
    };
};

export const getAllPostings = async (skip: number = 0, limit: number = 100): Promise<PostingListResponse> => {
    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString()
    });

    const response = await fetch(`${BASE_URL}?${params.toString()}`, {
        headers: getAuthHeader() as HeadersInit
    });

    if (!response.ok) throw new Error('Failed to fetch postings');
    return response.json();
};

// Fetch ALL records for client-side filtering/export if needed
export const getAllPostingRecords = async (): Promise<PostingResponse[]> => {
    const response = await fetch(`${BASE_URL}?skip=0&limit=100000`, {
        headers: getAuthHeader() as HeadersInit
    });

    if (!response.ok) throw new Error('Failed to fetch all posting records');
    const data = await response.json();
    return data.items;
};

export const createPosting = async (data: PostingCreate): Promise<PostingResponse> => {
    const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: getAuthHeader() as HeadersInit,
        body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Failed to create posting');
    return response.json();
};

export const updatePosting = async (id: string, data: PostingUpdate): Promise<PostingResponse> => {
    const response = await fetch(`${BASE_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeader() as HeadersInit,
        body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Failed to update posting');
    return response.json();
};

export const deletePosting = async (id: string): Promise<any> => {
    const response = await fetch(`${BASE_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader() as HeadersInit
    });

    if (!response.ok) throw new Error('Failed to delete posting');
    return response.json();
};

export const bulkDeletePostings = async (ids: string[]): Promise<any> => {
    const response = await fetch(`${BASE_URL}/bulk-delete`, {
        method: 'POST',
        headers: getAuthHeader() as HeadersInit,
        body: JSON.stringify({ ids })
    });

    if (!response.ok) throw new Error('Failed to bulk delete postings');
    return response.json();
};

export const deleteAllPostings = async (): Promise<any> => {
    const response = await fetch(`${BASE_URL}/all`, {
        method: 'DELETE',
        headers: getAuthHeader() as HeadersInit
    });

    if (!response.ok) throw new Error('Failed to delete all postings');
    return response.json();
};

export const bulkCreatePostings = async (data: BulkPostingCreateRequest): Promise<BulkUploadResponse> => {
    const response = await fetch(`${BASE_URL}/bulk`, {
        method: 'POST',
        headers: getAuthHeader() as HeadersInit,
        body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Failed to bulk create postings');
    return response.json();
};
