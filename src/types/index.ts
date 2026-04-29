// Type definitions for the application
// Add your custom types and interfaces here

export interface IUser {
    // TODO: Define user interface
}

export interface IResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}
