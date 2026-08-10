import { Injectable } from '@nestjs/common';
import { TaskRepository } from '../../shared/database/repositories/task.repository';
import { Task } from '../../shared/database/entities/task.entity';

@Injectable()
export class TaskQueryService {
    constructor(private readonly taskRepository: TaskRepository) {}

    async getTaskById(taskId: string): Promise<Task | null> {
        return this.taskRepository.findById(taskId);
    }

    async getAvailableTasks(workerId: string): Promise<Task[]> {
        return this.taskRepository.findAvailableForAssignment();
    }

    async getWorkerTasks(workerId: string, status?: string): Promise<Task[]> {
        if (status) {
            return this.taskRepository.findByWorkerAndStatus(workerId, status);
        }

        return this.taskRepository.findByWorker(workerId);
    }
}
