import { Injectable, BadRequestException } from '@nestjs/common';
import { TaskStatus } from '../types/task-status.enum';
import { TaskContext } from '../types/task-context.interface';

@Injectable()
export class TaskStateMachine {
    private readonly transitions: Map<TaskStatus, TaskStatus[]>;

    constructor() {
        this.transitions = new Map([
            [TaskStatus.DRAFT, [TaskStatus.ACTIVE, TaskStatus.CANCELLED]],
            [TaskStatus.ACTIVE, [TaskStatus.ASSIGNED, TaskStatus.EXPIRED, TaskStatus.CANCELLED]],
            [TaskStatus.ASSIGNED, [TaskStatus.ACCEPTED, TaskStatus.EXPIRED, TaskStatus.CANCELLED]],
            [TaskStatus.ACCEPTED, [TaskStatus.IN_PROGRESS, TaskStatus.EXPIRED, TaskStatus.CANCELLED]],
            [TaskStatus.IN_PROGRESS, [TaskStatus.SUBMITTED, TaskStatus.EXPIRED, TaskStatus.CANCELLED]],
            [TaskStatus.SUBMITTED, [TaskStatus.UNDER_REVIEW, TaskStatus.CANCELLED]],
            [TaskStatus.UNDER_REVIEW, [TaskStatus.APPROVED, TaskStatus.REJECTED, TaskStatus.CANCELLED]],
            [TaskStatus.REJECTED, [TaskStatus.ASSIGNED, TaskStatus.CANCELLED]],
            [TaskStatus.APPROVED, []],
            [TaskStatus.EXPIRED, []],
            [TaskStatus.CANCELLED, []],
        ]);
    }

    canTransition(from: TaskStatus, to: TaskStatus): boolean {
        const allowedTransitions = this.transitions.get(from);
        return allowedTransitions?.includes(to) ?? false;
    }

    validateTransition(context: TaskContext): void {
        const { currentStatus, targetStatus } = context;

        if (!this.canTransition(currentStatus as TaskStatus, targetStatus as TaskStatus)) {
            throw new BadRequestException(
                `Invalid state transition: ${currentStatus} -> ${targetStatus}`
            );
        }
    }

    getNextStates(status: TaskStatus): TaskStatus[] {
        return this.transitions.get(status) || [];
    }

    isTerminalState(status: TaskStatus): boolean {
        const nextStates = this.getNextStates(status);
        return nextStates.length === 0;
    }
}
