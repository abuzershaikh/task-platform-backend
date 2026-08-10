import { Injectable } from '@nestjs/common';
import { EarlyReallocationService } from './services/early-reallocation.service';
import { TaskReleaseService } from './services/task-release.service';
import { ReassignmentService } from './services/reassignment.service';
import { DeadlineMonitorService } from './services/deadline-monitor.service';
import { TaskReleaseRequest, ReallocationConfig } from './types/reallocation.types';

@Injectable()
export class ReallocationEngine {
    private config: ReallocationConfig = {
        earlyReallocationEnabled: true,
        earlyReallocationHours: 1,
        campaignAutoExtensionHours: 10,
    };

    constructor(
        private readonly earlyService: EarlyReallocationService,
        private readonly releaseService: TaskReleaseService,
        private readonly reassignmentService: ReassignmentService,
        private readonly monitorService: DeadlineMonitorService,
    ) { }

    updateConfig(newConfig: Partial<ReallocationConfig>) {
        this.config = { ...this.config, ...newConfig };
    }

    getConfig(): ReallocationConfig {
        return this.config;
    }

    async runMonitorCycle() {
        if (!this.config.earlyReallocationEnabled) {
            return null;
        }
        return this.monitorService.monitorDeadlines(
            this.config.earlyReallocationHours,
            this.config.campaignAutoExtensionHours,
        );
    }

    async evaluateEarlyReallocations() {
        return this.earlyService.evaluateEarlyReallocations(this.config.earlyReallocationHours);
    }

    async releaseWorker(request: TaskReleaseRequest) {
        return this.releaseService.releaseWorkerFromTask(request);
    }

    async reassignTask(taskId: string, campaignId: string) {
        return this.reassignmentService.reassignTaskToNewWorker(taskId, campaignId);
    }
}
