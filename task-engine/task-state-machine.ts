import { TaskStatus } from './types/task-status.enum';

export interface StateTransition {
    from: TaskStatus;
    to: TaskStatus;
    conditions?: string[];
    sideEffects?: string[];
}

export class TaskStateMachine {
    private static transitions: Map<TaskStatus, TaskStatus[]> = new Map([
        [TaskStatus.DRAFT, [TaskStatus.ACTIVE, TaskStatus.CANCELLED]],
        [TaskStatus.ACTIVE, [TaskStatus.ASSIGNED, TaskStatus.EXPIRED, TaskStatus.CANCELLED]],
        [TaskStatus.ASSIGNED, [TaskStatus.ACCEPTED, TaskStatus.ACTIVE, TaskStatus.EXPIRED, TaskStatus.CANCELLED]],
        [TaskStatus.ACCEPTED, [TaskStatus.IN_PROGRESS, TaskStatus.ACTIVE, TaskStatus.EXPIRED, TaskStatus.CANCELLED]],
        [TaskStatus.IN_PROGRESS, [TaskStatus.SUBMITTED, TaskStatus.ACTIVE, TaskStatus.EXPIRED, TaskStatus.CANCELLED]],
        [TaskStatus.SUBMITTED, [TaskStatus.UNDER_REVIEW, TaskStatus.ACTIVE, TaskStatus.EXPIRED]],
        [TaskStatus.UNDER_REVIEW, [TaskStatus.APPROVED, TaskStatus.REJECTED]],
        [TaskStatus.REJECTED, [TaskStatus.ACTIVE, TaskStatus.FAILED]],
        [TaskStatus.APPROVED, []],
        [TaskStatus.CANCELLED, []],
        [TaskStatus.EXPIRED, []],
        [TaskStatus.FAILED, []]
    ]);

    static canTransition(from: TaskStatus, to: TaskStatus): boolean {
        const allowedTransitions = this.transitions.get(from);
        if (!allowedTransitions) {
            return false;
        }
        return allowedTransitions.includes(to);
    }

    static getAllowedTransitions(from: TaskStatus): TaskStatus[] {
        return this.transitions.get(from) || [];
    }

    static isTerminalState(status: TaskStatus): boolean {
        const transitions = this.transitions.get(status);
        return !transitions || transitions.length === 0;
    }

    static validateTransition(from: TaskStatus, to: TaskStatus): void {
        if (!this.canTransition(from, to)) {
            throw new Error(
                `Invalid state transition: ${from} -> ${to}. Allowed transitions: ${this.getAllowedTransitions(from).join(', ')}`
            );
        }
    }

    static getTransitionPath(from: TaskStatus, to: TaskStatus): TaskStatus[] | null {
        if (from === to) return [from];
        if (this.canTransition(from, to)) return [from, to];

        // For complex paths (e.g., REJECTED -> ACTIVE -> ASSIGNED)
        const visited = new Set<TaskStatus>();
        const queue: { status: TaskStatus; path: TaskStatus[] }[] = [
            { status: from, path: [from] }
        ];

        while (queue.length > 0) {
            const { status, path } = queue.shift()!;

            if (status === to) {
                return path;
            }

            if (visited.has(status)) continue;
            visited.add(status);

            const nextStates = this.getAllowedTransitions(status);
            for (const nextState of nextStates) {
                if (!visited.has(nextState)) {
                    queue.push({
                        status: nextState,
                        path: [...path, nextState]
                    });
                }
            }
        }

        return null;
    }
}
