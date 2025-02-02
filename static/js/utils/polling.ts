import { config, loggingConfig } from '../config';
import { ApiResponse } from '../types';

type PollingCallback<T> = (data: T) => void;
type ErrorCallback = (error: Error) => void;

interface PollingOptions {
    interval: number;
    endpoint: string;
    onError?: ErrorCallback;
}

export class PollingManager {
    private intervals: Map<string, number> = new Map();
    private lastData: Map<string, any> = new Map();

    private async fetchData<T extends ApiResponse<any>>(endpoint: string): Promise<T> {
        const response = await fetch(endpoint, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error(`API call failed: ${response.statusText}`);
        }
        return response.json();
    }

    private hasDataChanged<T extends ApiResponse<any>>(endpoint: string, newData: T): boolean {
        const lastData = this.lastData.get(endpoint);
        if (!lastData) return true;
        return JSON.stringify(newData) !== JSON.stringify(lastData);
    }

    public startPolling<T extends ApiResponse<any>>({ 
        endpoint, 
        interval, 
        onError 
    }: PollingOptions, callback: PollingCallback<T>): void {
        // Clear any existing interval for this endpoint
        this.stopPolling(endpoint);

        if (loggingConfig.enabled && loggingConfig.polling.logConnectionEvents) {
            console.log(`Starting polling for ${endpoint} every ${interval}ms`);
        }

        const poll = async () => {
            try {
                const data = await this.fetchData<T>(endpoint);
                
                // Only trigger callback if data has changed
                if (this.hasDataChanged(endpoint, data)) {
                    if (loggingConfig.enabled && loggingConfig.polling.logDataChanges) {
                        console.log(`Data changed for ${endpoint}`, data);
                    }
                    this.lastData.set(endpoint, data);
                    callback(data);
                }
            } catch (error) {
                if (loggingConfig.enabled || loggingConfig.level === 'error') {
                    console.error(`Polling error for ${endpoint}:`, error);
                }
                if (onError && error instanceof Error) {
                    onError(error);
                }
            }
        };

        // Initial poll
        poll();

        // Set up interval
        const intervalId = window.setInterval(poll, interval);
        this.intervals.set(endpoint, intervalId);
    }

    public stopPolling(endpoint: string): void {
        const intervalId = this.intervals.get(endpoint);
        if (intervalId) {
            if (loggingConfig.enabled && loggingConfig.polling.logConnectionEvents) {
                console.log(`Stopping polling for ${endpoint}`);
            }
            clearInterval(intervalId);
            this.intervals.delete(endpoint);
            this.lastData.delete(endpoint);
        }
    }

    public stopAllPolling(): void {
        if (loggingConfig.enabled && loggingConfig.polling.logConnectionEvents) {
            console.log('Stopping all polling');
        }
        this.intervals.forEach((intervalId, endpoint) => {
            this.stopPolling(endpoint);
        });
    }
}
