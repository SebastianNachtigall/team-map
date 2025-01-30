import { Pin, Connection, ApiResponse } from '../types';

export class ApiService {
    static async getPins(): Promise<ApiResponse<Pin[]>> {
        try {
            const response = await fetch('/pins');
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching pins:', error);
            return {
                status: 'error',
                message: 'Failed to fetch pins'
            };
        }
    }

    static async createPin(pinData: Omit<Pin, 'id' | 'timestamp'>): Promise<ApiResponse<Pin>> {
        try {
            const response = await fetch('/pins', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(pinData)
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error creating pin:', error);
            return {
                status: 'error',
                message: 'Failed to create pin'
            };
        }
    }

    static async deletePin(pinId: string): Promise<ApiResponse<void>> {
        try {
            const response = await fetch(`/pins/${pinId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error deleting pin:', error);
            return {
                status: 'error',
                message: 'Failed to delete pin'
            };
        }
    }

    static async createConnection(sourceId: string, targetId: string): Promise<ApiResponse<Connection>> {
        try {
            const response = await fetch('/connections', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sourceId, targetId })
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error creating connection:', error);
            return {
                status: 'error',
                message: 'Failed to create connection'
            };
        }
    }
}
