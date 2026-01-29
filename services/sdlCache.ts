import { Staff } from '../types/staff';

export interface SDLCache {
    staffList: Staff[];
    allStaff: Staff[];
    total: number;
    page: number;
    limit: number;
    sortField: keyof Staff | null;
    sortDirection: 'asc' | 'desc';
    searchTerm: string;
    filters: {
        selectedStation: string;
        selectedRank: string;
        selectedConr: string;
        selectedState: string;
        selectedHOD: string;
        selectedStateCoord: string;
        selectedDirector: string;
        selectedEducation: string;
        selectedSecretary: string;
        selectedOthers: string;
        selectedPromotionDate: string;
    };
    lastUpdated: number;
}

let sdlCache: SDLCache | null = null;

export const setSDLCache = (cache: SDLCache) => {
    sdlCache = cache;
};

export const getSDLCache = (): SDLCache | null => {
    return sdlCache;
};

export const clearSDLCache = () => {
    sdlCache = null;
};
