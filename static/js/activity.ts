import { Activity, Pin, Connection, ConnectionData } from './types';
import { sanitizeText } from './utils/helpers';

export class ActivityFeed {
    private activities: Activity[] = [];
    private maxActivities: number = 50;
    private feedElement: HTMLElement;

    constructor(feedElementId: string) {
        console.log('Initializing ActivityFeed with element ID:', feedElementId);
        const element = document.getElementById(feedElementId);
        if (!element) {
            console.error(`Activity feed element with id ${feedElementId} not found`);
            throw new Error(`Activity feed element with id ${feedElementId} not found`);
        }
        this.feedElement = element;
        console.log('ActivityFeed initialized with element:', this.feedElement);
    }

    public addActivity(type: Activity['type'], data: ConnectionData = {}, isExisting: boolean = false) {
        console.log('Adding activity:', { type, data, isExisting });
        
        // Check for duplicate activity only for new items
        if (!isExisting) {
            const isDuplicate = this.activities.some(activity => {
                if (activity.type !== type) return false;
                
                if (type === 'pin_created' && activity.data?.pin && data?.pin) {
                    return activity.data.pin.id === data.pin.id;
                }
                
                if (type === 'connection_created' && activity.data?.connection && data?.connection) {
                    return activity.data.connection.id === data.connection.id;
                }
                
                return false;
            });

            if (isDuplicate) {
                console.log('Skipping duplicate activity');
                return;
            }
        }

        let activityText = '';

        switch (type) {
            case 'pin_created':
                if (data?.pin) {
                    activityText = `${sanitizeText(data.pin.name)} dropped a pin${data.pin.location ? ` near ${sanitizeText(data.pin.location)}` : ''}`;
                }
                break;
            case 'pin_deleted':
                if (data?.pin) {
                    activityText = `🗑️ Deleted pin "${sanitizeText(data.pin.name)}"`;
                }
                break;
            case 'connection_created':
                if (data?.connection) {
                    const sourcePin = window.app?.pinManager?.findPinById(data.connection.sourceId);
                    const targetPin = window.app?.pinManager?.findPinById(data.connection.targetId);
                    if (sourcePin && targetPin) {
                        activityText = `${sourcePin.name} ❤️ ${targetPin.name}`;
                    }
                }
                break;
            case 'connection_deleted':
                if (data?.connection) {
                    if (data.firstPinName && data.secondPinName) {
                        activityText = `${data.firstPinName} 💔 ${data.secondPinName}`;
                    } else {
                        const sourcePin = window.app?.pinManager?.findPinById(data.connection.sourceId);
                        const targetPin = window.app?.pinManager?.findPinById(data.connection.targetId);
                        if (sourcePin && targetPin) {
                            activityText = `${sourcePin.name} 💔 ${targetPin.name}`;
                        }
                    }
                }
                break;
            default:
                activityText = `Unknown activity type: ${type}`;
        }

        const activity: Activity = {
            id: crypto.randomUUID(),
            type,
            data: { ...data },
            timestamp: isExisting && data.pin?.timestamp ? data.pin.timestamp : new Date().toISOString(),
            message: activityText
        };

        console.log('Created activity:', activity);
        
        // Add activity to the array
        this.activities.push(activity);
        
        // Sort activities by timestamp in descending order
        this.activities.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        // Trim to max activities
        if (this.activities.length > this.maxActivities) {
            this.activities = this.activities.slice(0, this.maxActivities);
        }

        // Clear and rebuild the DOM with sorted activities
        this.feedElement.innerHTML = '';
        this.activities.forEach(act => {
            const activityItem = this.createActivityItem(act);
            activityItem.classList.add('new');
            if (act.type === 'pin_deleted') {
                activityItem.classList.add('removed');
            }
            this.feedElement.appendChild(activityItem);
            setTimeout(() => {
                activityItem.classList.add('show');
            }, 100);
        });
    }

    private formatTimestamp(timestamp: string): string {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
        
        if (diffInHours < 24) {
            // Today: show time only
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffInHours < 48) {
            // Yesterday: show "Yesterday" and time
            return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            // Older: show full date and time
            return date.toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    private createActivityItem(activity: Activity): HTMLElement {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        
        const activityContent = document.createElement('div');
        activityContent.className = 'activity-content';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'activity-text';
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'activity-time';
        timeDiv.textContent = this.formatTimestamp(activity.timestamp);
        
        textDiv.textContent = activity.message;
        activityContent.appendChild(textDiv);
        activityContent.appendChild(timeDiv);
        
        // Add image if present
        if (activity.data?.pin?.imageUrl) {
            const imgContainer = document.createElement('div');
            imgContainer.className = 'activity-image-container';
            
            const img = document.createElement('img');
            img.src = activity.data.pin.imageUrl;
            img.alt = activity.data.pin.name;
            img.className = 'activity-image';
            
            imgContainer.appendChild(img);
            activityContent.appendChild(imgContainer);
        }
        
        activityItem.appendChild(activityContent);
        return activityItem;
    }

    private addActivityToDOM(activity: Activity) {
        console.log('Adding activity to DOM:', activity);
        const activityItem = this.createActivityItem(activity);
        activityItem.classList.add('new');

        // Add removed class for pin removal activities
        if (activity.type === 'pin_deleted') {
            activityItem.classList.add('removed');
        }

        if (this.feedElement.firstChild) {
            this.feedElement.insertBefore(activityItem, this.feedElement.firstChild);
        } else {
            this.feedElement.appendChild(activityItem);
        }

        setTimeout(() => {
            activityItem.classList.add('show');
        }, 100);
        console.log('Activity added to DOM:', activityItem);
    }

    public clearActivities() {
        this.activities = [];
        this.feedElement.innerHTML = '';
    }
}
