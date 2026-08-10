import { Injectable, Logger } from '@nestjs/common';
import { TaskRepository } from '../../shared/database/repositories/task.repository';
import { CampaignWorkerParticipationRepository } from '../../shared/database/repositories/campaign-worker-participation.repository';
import { TaskAssignmentRepository } from '../../shared/database/repositories/task-assignment.repository';
import { ParticipationStatus } from '../../shared/database/entities/campaign-worker-participation.entity';
import { TaskAssignmentStatus } from '../../shared/database/entities/task-assignment.entity';
import { MatchingEngineService } from '../../matching-engine/matching-engine.service';

@Injectable()
export class TaskDeadlineService {
    private readonly logger = new Logger(TaskDeadlineService.name);

    constructor(
        private readonly taskRepo: TaskRepository,
        private readonly participationRepo: CampaignWorkerParticipationRepository,
        private readonly assignmentRepo: TaskAssignmentRepository,
        private readonly matchingEngine: MatchingEngineService,
    ) { }

    /**
     * Checks for overdue tasks and handles worker expiration.
     * Crucial Rule: When Worker A expires on Task 1, Worker A's participation record
     * remains in DB with status EXPIRED, so Worker A is PERMANENTLY EXCLUDED from this campaign.
     * Reallocation Engine finds a NEW unused worker (Worker B).
     */
    async processExpiredTasks(): Promise<{ expiredCount: number; reallocatedCount: number }> {
        const now = new Date();
        const activeAssignedTasks = await this.taskRepo.findAssignedTasks();
        let expiredCount = 0;
        let reallocatedCount = 0;

        for (const task of activeAssignedTasks) {
            const campaignId = task.campaignId || task.orderId;
            const assignedWorkerId = task.assignedTo;

            if (!assignedWorkerId || !task.deadline) continue;

            if (new Date(task.deadline) < now) {
                this.logger.warn(
                    `Task '${task.id}' for Campaign '${campaignId}' EXPIRED for Worker '${assignedWorkerId}'.`,
                );

                // 1. Mark participation as EXPIRED (Record REMAINS in DB for Campaign Exclusion!)
                await this.participationRepo.updateStatus(campaignId, assignedWorkerId, ParticipationStatus.EXPIRED);

                // 2. Mark active assignment as EXPIRED
                const activeAssignment = await this.assignmentRepo.findActiveAssignment(task.id);
                if (activeAssignment) {
                    await this.assignmentRepo.updateStatus(activeAssignment.id, TaskAssignmentStatus.EXPIRED, {
                        expiredAt: now,
                    });
                }

                // 3. Unassign task
                await this.taskRepo.update(task.id, {
                    assignedTo: undefined,
                    assignedAt: undefined,
                    status: 'active',
                });
                expiredCount++;

                // 4. Trigger Reallocation Engine (Matching Engine will EXCLUDE Worker A & all used campaign workers)
                try {
                    const matchResult = await this.matchingEngine.matchWorkersForTask({
                        taskId: task.id,
                    });

                    const selectedWorkerId = matchResult.matchedWorkers && matchResult.matchedWorkers.length > 0
                        ? matchResult.matchedWorkers[0].workerId
                        : null;

                    if (selectedWorkerId) {
                        await this.taskRepo.update(task.id, {
                            assignedTo: selectedWorkerId,
                            assignedAt: new Date(),
                            status: 'assigned',
                        });

                        await this.participationRepo.recordParticipation(
                            campaignId,
                            selectedWorkerId,
                            ParticipationStatus.ASSIGNED,
                        );

                        await this.assignmentRepo.createAssignment({
                            taskId: task.id,
                            campaignId,
                            workerId: selectedWorkerId,
                        });

                        reallocatedCount++;
                        this.logger.log(
                            `Task '${task.id}' REALLOCATED to NEW unused Worker '${selectedWorkerId}'.`,
                        );
                    } else {
                        this.logger.warn(
                            `Task '${task.id}' re-allocation pending: Insufficient eligible unique workers in Campaign '${campaignId}'.`,
                        );
                    }
                } catch (err) {
                    this.logger.error(`Error during reallocation for Task '${task.id}': ${err.message}`);
                }
            }
        }

        return { expiredCount, reallocatedCount };
    }
}
