export interface PageState {
    data?: any;
    total?: number;
    page?: number;
    limit?: number;
    sortField?: string | null;
    sortDirection?: 'asc' | 'desc';
    searchTerm?: string;
    filters?: Record<string, any>;
    lastUpdated?: number;
    [key: string]: any;
}

const cache: Record<string, PageState> = {};

export const setPageCache = (pageKey: string, state: PageState) => {
    cache[pageKey] = {
        ...state,
        lastUpdated: Date.now()
    };
};

export const getPageCache = (pageKey: string): PageState | null => {
    const entry = cache[pageKey];
    if (!entry) return null;
    return entry;
};

export const clearPageCache = (pageKey?: string) => {
    if (pageKey) {
        delete cache[pageKey];
    } else {
        Object.keys(cache).forEach(key => delete cache[key]);
    }
};
