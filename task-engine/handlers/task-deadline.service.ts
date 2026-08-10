import { Injectable, Logger } from '@nestjs/common';
import { ReallocationEngine } from '../../shared/engines/reallocation-engine/reallocation.engine';

@Injectable()
export class TaskDeadlineService {
    private readonly logger = new Logger(TaskDeadlineService.name);

    constructor(private readonly reallocationEngine: ReallocationEngine) { }

    /**
     * Executes the Deadline Monitor cycle.
     * Evaluates:
     * 1. Early Reallocation Window (1 hour before deadline): Replaces incomplete workers with reason EARLY_DEADLINE_RISK.
     * 2. Full Timeouts: Replaces expired workers with reason WORKER_TIMEOUT.
     * 3. Campaign Auto-Extensions: Extends campaign expiry by +10 hours if incomplete at cutoff date.
     */
    async runDeadlineMonitorCycle() {
        this.logger.log('Delegating Deadline Monitor cycle to Reallocation Engine...');
        return this.reallocationEngine.runMonitorCycle();
    }

    async processEarlyReallocations() {
        return this.reallocationEngine.evaluateEarlyReallocations();
    }

    async processExpiredTasks() {
        const result = await this.reallocationEngine.runMonitorCycle();
        return {
            expiredCount: result?.timeoutResults?.expiredCount || 0,
            reallocatedCount: result?.timeoutResults?.reallocatedCount || 0,
        };
    }
}
