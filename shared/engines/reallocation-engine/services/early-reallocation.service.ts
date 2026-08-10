import { Injectable, Logger } from '@nestjs/common';
import { TaskRepository } from '../../../database/repositories/task.repository';
import { OrderRepository } from '../../../database/repositories/order.repository';
import { TaskReleaseService } from './task-release.service';
import { ReassignmentService } from './reassignment.service';
import { ReleaseReason, EarlyReallocationEvaluation } from '../types/reallocation.types';

@Injectable()
export class EarlyReallocationService {
    private readonly logger = new Logger(EarlyReallocationService.name);

    constructor(
        private readonly taskRepo: TaskRepository,
        private readonly orderRepo: OrderRepository,
        private readonly releaseService: TaskReleaseService,
        private readonly reassignmentService: ReassignmentService,
    ) { }

    async evaluateEarlyReallocations(
        earlyReallocationHours: number = 1,
    ): Promise<EarlyReallocationEvaluation> {
        const now = new Date();
        const activeAssignedTasks = await this.taskRepo.findAssignedTasks();

        let evaluatedTasksCount = 0;
        let releasedTasksCount = 0;
        let reallocatedTasksCount = 0;

        for (const task of activeAssignedTasks) {
            const campaignId = task.campaignId || task.orderId;
            const assignedWorkerId = task.assignedTo;

            if (!assignedWorkerId || !task.deadline) continue;

            evaluatedTasksCount++;

            // Submitted Task Shield: Ignore tasks already submitted or under review
            const shieldedStatuses = ['SUBMITTED', 'submitted', 'UNDER_REVIEW', 'under_review', 'APPROVED', 'approved', 'completed'];
            if (shieldedStatuses.includes(task.status)) {
                continue;
            }

            const deadlineTime = new Date(task.deadline).getTime();
            const timeRemainingMs = deadlineTime - now.getTime();
            const earlyThresholdMs = earlyReallocationHours * 3600 * 1000;

            // Trigger Early Reallocation if inside early replacement window (e.g. <= 1 hour remaining)
            if (timeRemainingMs > 0 && timeRemainingMs <= earlyThresholdMs) {
                this.logger.warn(
                    `EARLY DEADLINE RISK: Task '${task.id}' has ${Math.round(timeRemainingMs / 60000)} minutes remaining. Worker '${assignedWorkerId}' has NOT submitted proof. Initiating early replacement.`,
                );

                // 1. Release worker with reason EARLY_DEADLINE_RISK
                const released = await this.releaseService.releaseWorkerFromTask({
                    taskId: task.id,
                    workerId: assignedWorkerId,
                    campaignId,
                    reason: ReleaseReason.EARLY_DEADLINE_RISK,
                    details: `Worker incomplete ${Math.round(timeRemainingMs / 60000)}m before deadline`,
                });

                if (released) {
                    releasedTasksCount++;

                    // 2. Check campaign cutoff date before reassigning
                    const order = await this.orderRepo.findById(task.orderId);
                    const campaignCutoff = order ? order.campaignExpiryDateSnapshot || order.campaignExpiryDate : null;

                    if (campaignCutoff && new Date(campaignCutoff) < now) {
                        this.logger.warn(`Campaign '${campaignId}' cutoff date has passed. Skipping reassignment.`);
                        continue;
                    }

                    // 3. Reassign to new unused worker (Worker 11)
                    const newWorkerId = await this.reassignmentService.reassignTaskToNewWorker(task.id, campaignId);
                    if (newWorkerId) {
                        reallocatedTasksCount++;
                    }
                }
            }
        }

        return {
            evaluatedTasksCount,
            releasedTasksCount,
            reallocatedTasksCount,
        };
    }
}
