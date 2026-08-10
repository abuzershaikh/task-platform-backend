export enum ReleaseReason {
    WORKER_TIMEOUT = 'WORKER_TIMEOUT',
    EARLY_DEADLINE_RISK = 'EARLY_DEADLINE_RISK',
    WORKER_CANCELLED = 'WORKER_CANCELLED',
    ADMIN_CANCELLED = 'ADMIN_CANCELLED',
    CAMPAIGN_CANCELLED = 'CAMPAIGN_CANCELLED',
}

export interface ReallocationConfig {
    earlyReallocationEnabled: boolean;
    earlyReallocationHours: number; // Default: 1 hour before completionDeadline
    campaignAutoExtensionHours: number; // Default: 10 hours if campaign incomplete at expiry date
}

export interface TaskReleaseRequest {
    taskId: string;
    workerId: string;
    campaignId: string;
    reason: ReleaseReason;
    details?: string;
}

export interface EarlyReallocationEvaluation {
    evaluatedTasksCount: number;
    releasedTasksCount: number;
    reallocatedTasksCount: number;
}
