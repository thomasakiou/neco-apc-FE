export type UserRole = 'super_admin' | 'user';

export interface Token {
    access_token: string;
    token_type: string;
}

export interface UserResponse {
    email: string;
    full_name: string;
    role: UserRole;
    is_active: boolean;
    id: string;
    created_at: string;
    updated_at: string | null;
}

export interface UserCreate {
    email: string;
    full_name: string;
    role: UserRole;
    is_active: boolean;
    password?: string;
}

export interface UserUpdate extends Partial<Omit<UserCreate, 'password'>> {
    password?: string;
}
