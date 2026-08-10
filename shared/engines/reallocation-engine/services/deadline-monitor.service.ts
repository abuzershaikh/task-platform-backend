import { Injectable, Logger } from '@nestjs/common';
import { TaskRepository } from '../../../database/repositories/task.repository';
import { OrderRepository } from '../../../database/repositories/order.repository';
import { TaskReleaseService } from './task-release.service';
import { ReassignmentService } from './reassignment.service';
import { ReleaseReason, PostDeadlineEvaluation } from '../types/reallocation.types';

@Injectable()
export class DeadlineMonitorService {
    private readonly logger = new Logger(DeadlineMonitorService.name);

    constructor(
        private readonly taskRepo: TaskRepository,
        private readonly orderRepo: OrderRepository,
        private readonly releaseService: TaskReleaseService,
        private readonly reassignmentService: ReassignmentService,
    ) { }

    /**
     * Executes the Post-Deadline Monitor cycle.
     * Rules:
     * 1. Workers are NOT removed before deadline. Workers get full duration to complete task.
     * 2. When completion deadline passes without proof submission: Release worker (reason: WORKER_TIMEOUT)
     *    and lock participation in campaign_worker_participation (Worker permanently excluded from this campaign).
     * 3. Reassign task to a NEW unused worker in the campaign.
     * 4. If campaign cutoff date passes with incomplete tasks, auto-extend campaign expiry by +10 hours.
     */
    async monitorDeadlines(campaignAutoExtensionHours: number = 10): Promise<PostDeadlineEvaluation> {
        this.logger.log('Starting Post-Deadline Monitor cycle...');

        // 1. Process Full Timeouts (Only AFTER worker task deadline has passed)
        const timeoutResults = await this.processFullTimeouts();

        // 2. Process Campaign Auto-Extensions (+10 hours if campaign incomplete at expiry date)
        const extensionResults = await this.processCampaignAutoExtensions(campaignAutoExtensionHours);

        return {
            evaluatedTasksCount: timeoutResults.evaluatedCount,
            expiredTasksCount: timeoutResults.expiredCount,
            reallocatedTasksCount: timeoutResults.reallocatedCount,
            extendedCampaignsCount: extensionResults.extendedCampaignsCount,
        };
    }

    async processFullTimeouts(): Promise<{ evaluatedCount: number; expiredCount: number; reallocatedCount: number }> {
        const now = new Date();
        const activeAssignedTasks = await this.taskRepo.findAssignedTasks();

        let evaluatedCount = 0;
        let expiredCount = 0;
        let reallocatedCount = 0;

        for (const task of activeAssignedTasks) {
            const campaignId = task.campaignId || task.orderId;
            const assignedWorkerId = task.assignedTo;

            if (!assignedWorkerId || !task.deadline) continue;

            evaluatedCount++;

            // Shield submitted/completed tasks
            const shieldedStatuses = ['SUBMITTED', 'submitted', 'UNDER_REVIEW', 'under_review', 'APPROVED', 'approved', 'completed'];
            if (shieldedStatuses.includes(task.status)) continue;

            // Worker gets full task deadline! Only execute release if NOW > task.deadline
            if (new Date(task.deadline) < now) {
                this.logger.warn(`POST-DEADLINE TIMEOUT: Task '${task.id}' deadline passed for Worker '${assignedWorkerId}'.`);

                // 1. Release worker with reason WORKER_TIMEOUT (Locks participation in DB -> Worker permanently excluded from Campaign)
                const released = await this.releaseService.releaseWorkerFromTask({
                    taskId: task.id,
                    workerId: assignedWorkerId,
                    campaignId,
                    reason: ReleaseReason.WORKER_TIMEOUT,
                    details: 'Task completion deadline expired without proof submission',
                });

                if (released) {
                    expiredCount++;

                    // 2. Check campaign cutoff date before reassigning
                    const order = await this.orderRepo.findById(task.orderId);
                    const campaignCutoff = order ? order.campaignExpiryDateSnapshot || order.campaignExpiryDate : null;

                    if (campaignCutoff && new Date(campaignCutoff) < now) {
                        this.logger.warn(`Campaign '${campaignId}' cutoff date has passed. Skipping reassignment.`);
                        continue;
                    }

                    // 3. Reassign task to a NEW unused worker in the campaign
                    const newWorkerId = await this.reassignmentService.reassignTaskToNewWorker(task.id, campaignId);
                    if (newWorkerId) {
                        reallocatedCount++;
                    }
                }
            }
        }

        return { evaluatedCount, expiredCount, reallocatedCount };
    }

    async processCampaignAutoExtensions(extensionHours: number = 10): Promise<{ extendedCampaignsCount: number }> {
        const now = new Date();
        let extendedCampaignsCount = 0;

        const activeOrders = await this.orderRepo.findActiveOrders();
        for (const order of activeOrders) {
            const expiryDate = order.campaignExpiryDateSnapshot || order.campaignExpiryDate;
            if (expiryDate && new Date(expiryDate) < now && order.tasksCompleted < order.totalTasksRequired) {
                const newExpiryDate = new Date(now.getTime() + extensionHours * 3600 * 1000);
                await this.orderRepo.update(order.id, {
                    campaignExpiryDate: newExpiryDate,
                    campaignExpiryDateSnapshot: newExpiryDate,
                });
                extendedCampaignsCount++;
                this.logger.log(
                    `CAMPAIGN AUTO-EXTENDED: Order '${order.id}' extended by +${extensionHours} hours to ${newExpiryDate.toISOString()} for remaining ${order.totalTasksRequired - order.tasksCompleted} tasks.`,
                );
            }
        }

        return { extendedCampaignsCount };
    }
}
